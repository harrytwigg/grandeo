import {
	BedrockRuntimeClient,
	type ContentBlock,
	ConverseCommand,
	type Message,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "grandeo/env";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
	region: env.AWS_REGION,
});

// Bedrock model used for statement parsing, reached through the Converse API so
// we can pass PDFs and images as native document/image content blocks.
//
// Two constraints pin this value down:
//   1. Converse needs a model with an ARN-versioned Bedrock model ID. Sonnet 5,
//      Opus 5 and the 4.7/4.8 family have no such ID - on Bedrock they are only
//      reachable through InvokeModel, which speaks the native Messages API shape
//      rather than Converse. Pointing Converse at them returns AccessDenied.
//   2. Newer models are served through cross-region inference rather than
//      on-demand throughput, so the ID needs a geo prefix. We use `eu.` to keep
//      data in EU regions, covering our default region (eu-west-2).
//
// Overridable via BEDROCK_MODEL_ID so the model can be changed without a deploy
// (e.g. `global.anthropic.claude-sonnet-4-6` to drop the regional premium).
// Whichever model is used must be granted to the AWS account under
// Bedrock > Model access, or every call fails with AccessDeniedException.
const CLAUDE_SONNET_MODEL_ID = env.BEDROCK_MODEL_ID;

/**
 * Process a file with Claude Sonnet (helper function)
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

			// Sanitize filename for Bedrock compatibility
			const sanitizedFileName = sanitizeDocumentFilename(fileName);

			// Add file context to the prompt
			const enhancedPrompt = `${prompt}\n\nFile: ${sanitizedFileName}\nMIME Type: ${mimeType}`;

			const result = await askClaudeWithFile({
				prompt: enhancedPrompt,
				fileContent: base64Content,
				mimeType,
				fileName: sanitizedFileName,
				systemPrompt,
			});

			if (result.isErr()) {
				throw result.error;
			}

			return result.value;
		})(),
		(error) => new Error(`Error processing file with Claude: ${error}`),
	);
};

/**
 * Process a file with Claude Sonnet and validate response with Zod schema
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
			// Convert Zod schema to JSON schema
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
			} catch (parseError) {
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
		(error) => new Error(`Error processing file with schema: ${error}`),
	);
};

/**
 * Send a prompt to Claude Sonnet with optional file content using the modern Converse API
 * This version allows specifying a custom filename for document processing
 * @param prompt - The text prompt to send to Claude
 * @param fileContent - Optional file content to include in the prompt (as base64 string)
 * @param mimeType - Optional MIME type of the file
 * @param fileName - Optional filename for document processing (will be sanitized)
 * @param systemPrompt - Optional system prompt to set Claude's behavior
 * @returns ResultAsync<string, Error> - The response from Claude or error
 */
export const askClaudeWithFile = ({
	prompt,
	fileContent,
	mimeType,
	fileName,
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
			// Prepare the message content blocks
			const contentBlocks: ContentBlock[] = [
				{
					text: prompt,
				},
			];

			// Add file content if provided
			if (fileContent && mimeType) {
				if (mimeType.startsWith("image/")) {
					// For images, use the image content block
					contentBlocks.push({
						image: {
							format: mimeType.split("/")[1] as "png" | "jpeg" | "gif" | "webp",
							source: {
								bytes: Buffer.from(fileContent, "base64"),
							},
						},
					});
				} else if (mimeType === "application/pdf") {
					// For PDFs, use the document content block with sanitized filename
					const sanitizedFileName = fileName
						? sanitizeDocumentFilename(fileName)
						: "document.pdf";
					contentBlocks.push({
						document: {
							format: "pdf",
							name: sanitizedFileName,
							source: {
								bytes: Buffer.from(fileContent, "base64"),
							},
						},
					});
				} else {
					// For other files, try to decode and include as text
					try {
						const decodedContent = Buffer.from(fileContent, "base64").toString(
							"utf-8",
						);
						contentBlocks[0] = {
							text: `${prompt}\n\nFile Content (${mimeType}):\n${decodedContent}`,
						};
					} catch (error) {
						// If decoding fails, include the file info but note it couldn't be processed
						console.warn(`Failed to decode file content: ${error}`);
						contentBlocks[0] = {
							text: `${prompt}\n\nNote: File of type ${mimeType} was provided but could not be processed as text.`,
						};
					}
				}
			}

			// Prepare the conversation
			const messages: Message[] = [
				{
					role: "user",
					content: contentBlocks,
				},
			];

			// Prepare the request parameters. Sampling parameters (temperature/topP/
			// topK) are left at their defaults and behaviour is steered through the
			// system prompt instead.
			const params = {
				modelId: CLAUDE_SONNET_MODEL_ID,
				messages,
				inferenceConfig: {
					// Thinking shares this budget with the response text, so leave
					// headroom for both.
					maxTokens: 32000,
				},
				...(systemPrompt && { system: [{ text: systemPrompt }] }),
			};

			const command = new ConverseCommand(params);
			const response = await bedrockClient.send(command);

			const responseBlocks = response.output?.message?.content;
			if (!responseBlocks?.length) {
				throw new Error("No response content received from Bedrock");
			}

			// The response may lead with one or more reasoningContent blocks before
			// the answer text, so pick out the first text block rather than assuming
			// the answer is at index 0.
			const textBlock = responseBlocks.find(
				(block) => "text" in block && block.text,
			);
			if (textBlock && "text" in textBlock && textBlock.text) {
				return textBlock.text;
			}

			throw new Error("Unexpected response format from Bedrock");
		})(),
		(error) => new Error(`Error calling Claude Sonnet: ${error}`),
	);
};

/**
 * Sanitize filename for Bedrock document processing
 * Bedrock only allows alphanumeric characters, whitespace, hyphens, parentheses, and square brackets
 * No more than one consecutive whitespace character is allowed
 */
const sanitizeDocumentFilename = (filename: string): string => {
	return (
		filename
			// Replace underscores with hyphens
			.replace(/_/g, "-")
			// Remove any characters that aren't alphanumeric, whitespace, hyphens, parentheses, or square brackets
			.replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, "")
			// Replace multiple consecutive whitespace characters with a single space
			.replace(/\s+/g, " ")
			// Trim whitespace from start and end
			.trim() ||
		// If filename is empty after sanitization, use a default name
		"document"
	);
};
