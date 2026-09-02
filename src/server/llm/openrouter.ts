import { OpenRouter } from "@openrouter/sdk";
import type { ChatContentItems } from "@openrouter/sdk/models";
import * as sdkErrors from "@openrouter/sdk/models/errors";
import { env } from "grandeo/env";
import { LlmError } from "./errors";
import type {
	CompletionRequest,
	CompletionResult,
	StatementParsingProvider,
} from "./provider";

const PROVIDER_NAME = "openrouter";

/**
 * Statement parsing through OpenRouter.
 *
 * OpenRouter is a routing layer, not a host: one API key reaches many upstream
 * providers, and the model ID is a plain string with no per-region entitlement
 * to enable. That is the point of moving here - the previous Bedrock path
 * needed the right model ID *and* the right AWS region *and* an account-level
 * model-access grant, and all three had to be correct before a single statement
 * could be parsed.
 *
 * Routing is left to OpenRouter across every provider serving the configured
 * model unless OPENROUTER_PROVIDER pins it - see UPSTREAM_PROVIDER below.
 */

/**
 * Optional pin to a single upstream provider.
 *
 * Unset - the default - every provider OpenRouter lists for the configured
 * model is allowed, and OpenRouter fails over between them. A single provider
 * going down or dropping the model then costs latency rather than every
 * statement upload.
 *
 * Set, it becomes a whitelist rather than a preference: the request also sets
 * `allowFallbacks: false`, so if that provider cannot serve the request the
 * call fails instead of landing somewhere else. That is the setting to reach
 * for when which company processes statement data has to be a deliberate
 * choice.
 */
const UPSTREAM_PROVIDER = env.OPENROUTER_PROVIDER;

/** How routing is described in error messages. */
const ROUTING_LABEL = UPSTREAM_PROVIDER ?? "The upstream provider";

const client = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });

/**
 * Ceiling on the response, not the document.
 *
 * A statement expands to a JSON transaction list far larger than the prompt, so
 * this needs headroom. It is well inside what the configured model allows, and
 * a response that hits it surfaces as `response-truncated` rather than as
 * malformed JSON.
 */
const MAX_TOKENS = 32000;

/** Image media types that go to the model as an image part. */
const SUPPORTED_IMAGE_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;

const isSupportedImageMediaType = (mimeType: string): boolean =>
	(SUPPORTED_IMAGE_MEDIA_TYPES as readonly string[]).includes(mimeType);

/**
 * Build the user message content for a document.
 *
 * The document goes before the instruction: models attend to a document better
 * when the question follows it.
 *
 * PDFs are handled by OpenRouter's `file-parser` plugin rather than by the
 * model. GLM 5.3 Flash accepts text, image and video - not PDF - so without the
 * plugin every PDF statement would fail. The plugin extracts the PDF server-side
 * and passes text through, which makes PDF support a property of this
 * integration rather than of whichever model is configured.
 */
const buildContent = (request: CompletionRequest): ChatContentItems[] => {
	const parts: ChatContentItems[] = [];
	const document = request.document;
	let promptText = request.prompt;

	if (document) {
		if (isSupportedImageMediaType(document.mimeType)) {
			parts.push({
				type: "image_url",
				imageUrl: {
					url: `data:${document.mimeType};base64,${document.content}`,
				},
			});
		} else if (document.mimeType === "application/pdf") {
			parts.push({
				type: "file",
				file: {
					filename: document.fileName,
					fileData: `data:application/pdf;base64,${document.content}`,
				},
			});
		} else {
			// CSV, TXT and anything else the uploader accepts: inline it as text.
			try {
				const decoded = Buffer.from(document.content, "base64").toString(
					"utf-8",
				);
				promptText = `${request.prompt}\n\nFile Content (${document.mimeType}):\n${decoded}`;
			} catch (error) {
				console.warn(`Failed to decode file content: ${error}`);
				promptText = `${request.prompt}\n\nNote: File of type ${document.mimeType} was provided but could not be processed as text.`;
			}
		}
	}

	parts.push({ type: "text", text: promptText });
	return parts;
};

/**
 * Translate an SDK or transport failure into an LlmError.
 *
 * Mapped by HTTP status class rather than by message text, so a reworded
 * upstream message cannot silently reclassify a failure.
 */
const toLlmError = (error: unknown, modelId: string): LlmError => {
	if (error instanceof LlmError) {
		return error;
	}

	const base = { provider: PROVIDER_NAME, modelId, cause: error } as const;

	if (error instanceof sdkErrors.UnauthorizedResponseError) {
		return new LlmError({
			...base,
			kind: "access-denied",
			message:
				"OpenRouter rejected the API key. Check OPENROUTER_API_KEY is set on this stage and has not been revoked.",
		});
	}

	if (error instanceof sdkErrors.PaymentRequiredResponseError) {
		return new LlmError({
			...base,
			kind: "access-denied",
			message:
				"The OpenRouter account is out of credit. Top it up to resume statement parsing.",
		});
	}

	if (error instanceof sdkErrors.ForbiddenResponseError) {
		return new LlmError({
			...base,
			kind: "refused",
			message:
				"OpenRouter's moderation declined this document. If it is a legitimate statement, narrowing the account parsing prompt may help.",
		});
	}

	if (error instanceof sdkErrors.NotFoundResponseError) {
		return new LlmError({
			...base,
			kind: "invalid-request",
			message: `OpenRouter has no model "${modelId}". Check OPENROUTER_MODEL_ID against the list at https://openrouter.ai/models - IDs are "<author>/<slug>", e.g. "z-ai/glm-5.3-flash".`,
		});
	}

	if (error instanceof sdkErrors.BadRequestResponseError) {
		return new LlmError({
			...base,
			kind: "invalid-request",
			message: UPSTREAM_PROVIDER
				? `OpenRouter rejected the request for "${modelId}": ${error.message}. OPENROUTER_PROVIDER pins routing to "${UPSTREAM_PROVIDER}" - check that provider serves this model and supports structured outputs.`
				: `OpenRouter rejected the request for "${modelId}": ${error.message}.`,
		});
	}

	if (error instanceof sdkErrors.PayloadTooLargeResponseError) {
		return new LlmError({
			...base,
			kind: "invalid-request",
			message:
				"This statement is too large for one request. Split it and upload the parts separately.",
		});
	}

	if (error instanceof sdkErrors.TooManyRequestsResponseError) {
		return new LlmError({
			...base,
			kind: "rate-limited",
			message: `OpenRouter rate-limited the request for "${modelId}". Retry shortly.`,
		});
	}

	if (
		error instanceof sdkErrors.ProviderOverloadedResponseError ||
		error instanceof sdkErrors.ServiceUnavailableResponseError ||
		error instanceof sdkErrors.BadGatewayResponseError ||
		error instanceof sdkErrors.InternalServerResponseError ||
		error instanceof sdkErrors.RequestTimeoutResponseError ||
		error instanceof sdkErrors.EdgeNetworkTimeoutResponseError ||
		error instanceof sdkErrors.ConnectionError ||
		error instanceof sdkErrors.RequestTimeoutError
	) {
		return new LlmError({
			...base,
			kind: "unavailable",
			message: UPSTREAM_PROVIDER
				? `${UPSTREAM_PROVIDER} is temporarily unavailable for "${modelId}". Retry shortly. OPENROUTER_PROVIDER pins routing to that provider, so this does not fail over automatically.`
				: `No provider was able to serve "${modelId}". Retry shortly.`,
		});
	}

	return new LlmError({
		...base,
		kind: "unknown",
		message: `OpenRouter call for "${modelId}" failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	});
};

const modelId = env.OPENROUTER_MODEL_ID;

export const openRouterProvider: StatementParsingProvider = {
	name: PROVIDER_NAME,
	modelId,

	async complete(request: CompletionRequest): Promise<CompletionResult> {
		let result: Awaited<ReturnType<typeof client.chat.send>>;

		try {
			result = await client.chat.send({
				chatRequest: {
					model: modelId,
					stream: false,
					maxTokens: MAX_TOKENS,
					messages: [
						...(request.systemPrompt
							? [{ role: "system" as const, content: request.systemPrompt }]
							: []),
						{ role: "user" as const, content: buildContent(request) },
					],
					// Only constrain routing when a provider is pinned; otherwise
					// let OpenRouter use every provider serving this model, with
					// its own fallback order. See UPSTREAM_PROVIDER.
					...(UPSTREAM_PROVIDER && {
						provider: {
							only: [UPSTREAM_PROVIDER],
							allowFallbacks: false,
						},
					}),
					// Server-side PDF extraction, so PDF support does not depend on
					// the configured model accepting PDF input.
					plugins: [
						{ id: "file-parser" as const, pdf: { engine: "pdf-text" } },
					],
					// Schema enforced upstream where the provider supports it. The
					// caller still validates with Zod, so this narrows the failure
					// rate rather than being load-bearing.
					...(request.responseSchema && {
						responseFormat: {
							type: "json_schema" as const,
							jsonSchema: {
								name: request.responseSchema.name,
								schema: request.responseSchema.schema,
							},
						},
					}),
				},
			});
		} catch (error) {
			throw toLlmError(error, modelId);
		}

		// The non-streaming overload returns a ChatResult; an EventStream here
		// would mean `stream: false` was ignored, which is worth saying plainly
		// rather than failing on a missing property.
		if (!("choices" in result)) {
			throw new LlmError({
				provider: PROVIDER_NAME,
				modelId,
				kind: "unknown",
				message:
					"OpenRouter returned a stream for a non-streaming request. This is an SDK or API contract change, not a configuration problem.",
			});
		}

		const choice = result.choices[0];

		if (!choice) {
			throw new LlmError({
				provider: PROVIDER_NAME,
				modelId,
				kind: "unknown",
				message: `${ROUTING_LABEL} returned no choices for this document.`,
			});
		}

		if (choice.finishReason === "length") {
			throw new LlmError({
				provider: PROVIDER_NAME,
				modelId,
				kind: "response-truncated",
				message: `The model hit the ${MAX_TOKENS}-token response limit before finishing this document. It is likely too long to parse in one pass.`,
			});
		}

		if (choice.finishReason === "content_filter") {
			throw new LlmError({
				provider: PROVIDER_NAME,
				modelId,
				kind: "refused",
				message:
					"The model declined to process this document. If it is a legitimate statement, re-uploading or narrowing the account parsing prompt may help.",
			});
		}

		const content = choice.message.content;
		const text =
			typeof content === "string"
				? content
				: // A content-parts array: keep the text parts, drop the rest.
					(content ?? [])
						.map((part) =>
							typeof part === "object" && part && "text" in part
								? String((part as { text?: unknown }).text ?? "")
								: "",
						)
						.join("");

		if (!text.trim()) {
			throw new LlmError({
				provider: PROVIDER_NAME,
				modelId,
				kind: "unknown",
				message: `${ROUTING_LABEL} returned no text content for this document.`,
			});
		}

		// Without a pin, the serving provider is only knowable from the response.
		// OpenRouter returns it as a top-level `provider`, which the SDK's result
		// type does not declare - so read it defensively and fall back to the pin.
		const responseProvider = (result as { provider?: unknown }).provider;

		return {
			text,
			modelId: result.model ?? modelId,
			servedBy:
				typeof responseProvider === "string"
					? responseProvider
					: UPSTREAM_PROVIDER,
		};
	},
};
