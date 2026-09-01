import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "grandeo/env";
import { ResultAsync } from "neverthrow";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Claude is reached through the Messages API endpoint on Bedrock
// (`https://bedrock-mantle.{region}.api.aws/anthropic`), not the older
// bedrock-runtime Converse/InvokeModel APIs.
//
// The Converse API only accepts models with ARN-versioned Bedrock model IDs,
// and Anthropic has stopped issuing those for current-generation models - so
// that path is structurally capped at Sonnet 4.6 and the ceiling drops as
// models retire. This endpoint speaks the same request shape as Anthropic's
// first-party API, so moving to a newer model is a model-ID string change.
//
// Credentials and region resolve through the standard AWS chain, which in
// Lambda means the execution role. Note the role needs
// `bedrock-mantle:CreateInference` - a different IAM service namespace from
// `bedrock:*`, which does NOT grant it (see sst.config.ts).
const bedrockClient = new AnthropicBedrockMantle({
	awsRegion: env.AWS_REGION,
});

// Bedrock model used for statement parsing.
//
// Model IDs on this endpoint carry an `anthropic.` provider prefix, no version
// suffix, and no geo prefix. The `eu.` / `global.` prefixes are a legacy
// bedrock-runtime cross-region-inference-profile convention that only ever
// applied to models with ARN-versioned Bedrock IDs; current-generation models
// (Sonnet 5, Opus 5, ...) have no such IDs and are not in that table, so an
// `eu.` prefix here is simply an unknown model and comes back as a 404.
//
// Region - and so data residency - is carried by the endpoint hostname
// (`bedrock-mantle.{AWS_REGION}.api.aws`), not by the model ID: the request is
// kept in the region it was sent to. AWS_REGION defaults to eu-west-2, so the
// bare `anthropic.` ID keeps statement data in London.
//
// We default to Sonnet 5, a current-generation model. Overridable via
// BEDROCK_MODEL_ID so the model can be changed without a deploy - e.g.
// `anthropic.claude-opus-5` for a more capable model, or
// `anthropic.claude-haiku-4-5` for a cheaper one.
//
// Whichever model is used must be enabled for the AWS account under
// Bedrock > Model access, or every call fails with AccessDeniedException.
const STATEMENT_PARSING_MODEL_ID = env.BEDROCK_MODEL_ID;

// Shared by thinking and the response text, so leave headroom for both. The
// request is streamed, which is what keeps a budget this size from tripping the
// SDK's HTTP timeout on long documents.
const MAX_TOKENS = 32000;

/**
 * Why a Bedrock call failed, in terms the caller can act on.
 *
 * Bedrock reports a missing model entitlement and a missing IAM permission with
 * the same `AccessDeniedException`, and its message ("<model> is not available
 * for this account") reads like an entitlement problem in both cases - so the
 * remedy has to be spelled out rather than inferred from the message.
 */
export type BedrockFailureKind =
	| "access-denied"
	| "invalid-request"
	| "rate-limited"
	| "unavailable"
	| "response-truncated"
	| "refused"
	| "unknown";

/**
 * A Bedrock failure carrying an actionable message.
 *
 * The helpers below deliberately re-throw this untouched rather than wrapping
 * it, so the reason survives the call chain instead of arriving at the API
 * layer behind several layers of `Error:` prefixes.
 */
export class BedrockError extends Error {
	readonly kind: BedrockFailureKind;
	readonly modelId: string;

	constructor({
		kind,
		message,
		modelId,
		cause,
	}: {
		kind: BedrockFailureKind;
		message: string;
		modelId: string;
		cause?: unknown;
	}) {
		super(message, { cause });
		this.name = "BedrockError";
		this.kind = kind;
		this.modelId = modelId;
	}
}

/** True for an error that already carries an actionable reason. */
const isBedrockError = (error: unknown): error is BedrockError =>
	error instanceof BedrockError;

/**
 * Turn a thrown value into a BedrockError with a message that says what to do.
 */
const toBedrockError = (error: unknown): BedrockError => {
	if (isBedrockError(error)) {
		return error;
	}

	const modelId = STATEMENT_PARSING_MODEL_ID;
	const region = env.AWS_REGION;

	if (error instanceof Anthropic.PermissionDeniedError) {
		return new BedrockError({
			kind: "access-denied",
			modelId,
			cause: error,
			message: `Bedrock denied access to "${modelId}" in ${region}. This is usually one of: the model is not enabled for the AWS account under Bedrock > Model access; or the execution role is missing "bedrock-mantle:CreateInference" (a different IAM namespace from "bedrock:*", which does not grant it). Set BEDROCK_MODEL_ID to a model the account has enabled to change it without a deploy.`,
		});
	}

	if (error instanceof Anthropic.BadRequestError) {
		return new BedrockError({
			kind: "invalid-request",
			modelId,
			cause: error,
			message: `Bedrock rejected the request for "${modelId}": ${error.message}. If BEDROCK_MODEL_ID is set, check it is a valid Claude-on-Bedrock model ID (e.g. "anthropic.claude-sonnet-5").`,
		});
	}

	if (error instanceof Anthropic.NotFoundError) {
		return new BedrockError({
			kind: "invalid-request",
			modelId,
			cause: error,
			message: `Bedrock has no model "${modelId}" in ${region}. Check BEDROCK_MODEL_ID: on this endpoint IDs take an "anthropic." provider prefix and nothing else - no geo prefix ("eu." / "global.") and no version suffix - e.g. "anthropic.claude-sonnet-5".`,
		});
	}

	if (error instanceof Anthropic.RateLimitError) {
		return new BedrockError({
			kind: "rate-limited",
			modelId,
			cause: error,
			message: `Bedrock rate-limited the request for "${modelId}". Retry shortly.`,
		});
	}

	if (
		error instanceof Anthropic.APIConnectionError ||
		(error instanceof Anthropic.APIError &&
			typeof error.status === "number" &&
			error.status >= 500)
	) {
		return new BedrockError({
			kind: "unavailable",
			modelId,
			cause: error,
			message: `Bedrock is temporarily unavailable for "${modelId}". Retry shortly.`,
		});
	}

	return new BedrockError({
		kind: "unknown",
		modelId,
		cause: error,
		message: `Bedrock call for "${modelId}" failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	});
};

/**
 * Process a file with Claude (helper function)
 * @param prompt - The prompt describing what to do with the file
 * @param fileBuffer - The file content as a buffer
 * @param fileName - The name of the file
 * @param mimeType - The MIME type of the file
 * @param systemPrompt - Optional system prompt to set Claude's behavior
 * @returns ResultAsync<string, Error> - The response from Claude or error
 */
export const processFileWithClaude = ({
	prompt,
	fileBuffer,
	fileName,
	systemPrompt,
	mimeType,
}: {
	prompt: string;
	fileBuffer: Buffer;
	fileName: string;
	systemPrompt?: string;
	mimeType: string;
}): ResultAsync<string, Error> => {
	return ResultAsync.fromPromise(
		(async () => {
			// Convert buffer to base64
			const base64Content = fileBuffer.toString("base64");

			// Add file context to the prompt
			const enhancedPrompt = `${prompt}\n\nFile: ${fileName}\nMIME Type: ${mimeType}`;

			const result = await askClaudeWithFile({
				prompt: enhancedPrompt,
				fileContent: base64Content,
				mimeType,
				fileName,
				systemPrompt,
			});

			if (result.isErr()) {
				throw result.error;
			}

			return result.value;
		})(),
		// A BedrockError already says what went wrong and what to do about it -
		// re-wrapping it here is what produced the old quadruple-prefixed 500.
		(error) => toBedrockError(error),
	);
};

/**
 * Process a file with Claude and validate response with Zod schema
 * @param fileName - The name of the file
 * @param fileBuffer - The file content as a buffer
 * @param schema - Zod schema for response validation
 * @param prompt - The prompt describing what to do with the file
 * @param mimeType - The MIME type of the file
 * @returns ResultAsync<T, Error> - The parsed and validated response or error
 */
export const processFileWithSchema = <T extends z.ZodTypeAny>({
	fileName,
	fileBuffer,
	schema,
	prompt,
	mimeType,
}: {
	fileName: string;
	fileBuffer: Buffer;
	schema: T;
	prompt: string;
	mimeType: string;
}): ResultAsync<z.output<T>, Error> => {
	return ResultAsync.fromPromise(
		(async () => {
			// Convert Zod schema to JSON schema.
			//
			// The schema is described in the prompt rather than enforced with the
			// structured-outputs API, which Claude on Bedrock does not support.
			const jsonSchema = zodToJsonSchema(schema);

			// Create enhanced prompt with schema requirements
			const enhancedPrompt = `${prompt}

Please respond with a valid JSON object that matches this exact schema:

${JSON.stringify(jsonSchema, null, 2)}

Important: 
- Respond ONLY with the JSON object, no additional text
- Ensure the response is valid JSON
- Follow the schema structure exactly`;

			// Process the file with Claude using appropriate system prompt
			const result = await processFileWithClaude({
				prompt: enhancedPrompt,
				fileBuffer,
				fileName,
				mimeType,
				systemPrompt:
					"You are a precise data extraction specialist. Your job is to analyze documents and extract structured data according to the provided schema. Always respond with valid JSON that exactly matches the requested format. Do not include any explanatory text, only the JSON response.",
			});

			if (result.isErr()) {
				throw result.error;
			}

			const response = result.value;

			// Try to parse the JSON response
			let parsedResponse: unknown;
			try {
				parsedResponse = JSON.parse(response);
			} catch {
				// If direct parsing fails, try to extract JSON from the response
				const jsonMatch = response.match(/\{[\s\S]*\}/);
				if (jsonMatch?.[0]) {
					parsedResponse = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error(`Invalid JSON response from Claude: ${response}`);
				}
			}

			// Validate against the Zod schema
			const validatedResponse = schema.parse(parsedResponse);

			return validatedResponse;
		})(),
		(error) =>
			isBedrockError(error)
				? error
				: new Error(
						`Error processing file with schema: ${
							error instanceof Error ? error.message : String(error)
						}`,
						{ cause: error },
					),
	);
};

/**
 * Send a prompt to Claude with optional file content using the Messages API.
 * @param prompt - The text prompt to send to Claude
 * @param fileContent - Optional file content to include in the prompt (as base64 string)
 * @param mimeType - Optional MIME type of the file
 * @param fileName - Optional filename, included in the prompt text for context
 * @param systemPrompt - Optional system prompt to set Claude's behavior
 * @returns ResultAsync<string, Error> - The response from Claude or error
 */
export const askClaudeWithFile = ({
	prompt,
	fileContent,
	mimeType,
	systemPrompt,
}: {
	prompt: string;
	fileContent?: string;
	mimeType?: string;
	fileName?: string;
	systemPrompt?: string;
}): ResultAsync<string, Error> => {
	return ResultAsync.fromPromise(
		(async () => {
			// Document and image blocks go *before* the text block - Claude attends
			// to a document better when the instruction follows it.
			const contentBlocks: Anthropic.ContentBlockParam[] = [];
			let promptText = prompt;

			if (fileContent && mimeType) {
				if (isSupportedImageMediaType(mimeType)) {
					contentBlocks.push({
						type: "image",
						source: {
							type: "base64",
							media_type: mimeType,
							data: fileContent,
						},
					});
				} else if (mimeType === "application/pdf") {
					contentBlocks.push({
						type: "document",
						source: {
							type: "base64",
							media_type: "application/pdf",
							data: fileContent,
						},
					});
				} else {
					// For other files, try to decode and include as text
					try {
						const decodedContent = Buffer.from(fileContent, "base64").toString(
							"utf-8",
						);
						promptText = `${prompt}\n\nFile Content (${mimeType}):\n${decodedContent}`;
					} catch (error) {
						// If decoding fails, include the file info but note it couldn't be processed
						console.warn(`Failed to decode file content: ${error}`);
						promptText = `${prompt}\n\nNote: File of type ${mimeType} was provided but could not be processed as text.`;
					}
				}
			}

			contentBlocks.push({ type: "text", text: promptText });

			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: contentBlocks,
				},
			];

			// Streamed so a large max_tokens cannot trip the SDK's HTTP timeout.
			//
			// Sampling parameters (temperature/top_p/top_k) are rejected on
			// current-generation models and behaviour is steered through the system
			// prompt instead. Adaptive thinking is the only supported thinking mode
			// on these models; `budget_tokens` is rejected.
			const stream = bedrockClient.messages.stream({
				model: STATEMENT_PARSING_MODEL_ID,
				max_tokens: MAX_TOKENS,
				thinking: { type: "adaptive" },
				messages,
				...(systemPrompt && { system: systemPrompt }),
			});

			const response = await stream.finalMessage();

			if (response.stop_reason === "refusal") {
				throw new BedrockError({
					kind: "refused",
					modelId: STATEMENT_PARSING_MODEL_ID,
					message:
						"Claude declined to process this document. If it is a legitimate statement, re-uploading or narrowing the account parsing prompt may help.",
				});
			}

			if (response.stop_reason === "max_tokens") {
				throw new BedrockError({
					kind: "response-truncated",
					modelId: STATEMENT_PARSING_MODEL_ID,
					message: `Claude hit the ${MAX_TOKENS}-token response limit before finishing this document. It is likely too long to parse in one pass.`,
				});
			}

			// The response may lead with one or more thinking blocks before the
			// answer, so pick out the first text block rather than assuming it is at
			// index 0.
			const textBlock = response.content.find(
				(block) => block.type === "text" && block.text,
			);

			if (textBlock?.type === "text") {
				return textBlock.text;
			}

			throw new BedrockError({
				kind: "unknown",
				modelId: STATEMENT_PARSING_MODEL_ID,
				message: "Bedrock returned no text content for this document.",
			});
		})(),
		(error) => toBedrockError(error),
	);
};

/** Image media types the Messages API accepts as an image block. */
const SUPPORTED_IMAGE_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;

type SupportedImageMediaType = (typeof SUPPORTED_IMAGE_MEDIA_TYPES)[number];

const isSupportedImageMediaType = (
	mimeType: string,
): mimeType is SupportedImageMediaType =>
	(SUPPORTED_IMAGE_MEDIA_TYPES as readonly string[]).includes(mimeType);
