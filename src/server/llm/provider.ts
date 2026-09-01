import type { LlmError } from "./errors";

/**
 * A document handed to a provider for extraction.
 *
 * `content` is base64 because that is what every provider's wire format wants
 * and what S3 hands back after `toString("base64")` - decoding it here only to
 * re-encode it downstream would be wasted work on files that can run to
 * megabytes.
 */
export type ParseDocument = {
	fileName: string;
	mimeType: string;
	/** Base64-encoded file bytes. */
	content: string;
};

/**
 * A JSON Schema the response must conform to.
 *
 * Providers that support server-side structured outputs should enforce this;
 * the rest describe it in the prompt and let the caller validate. Either way
 * the caller re-validates with Zod, so a provider that ignores this is degraded
 * rather than broken.
 */
export type ResponseSchema = {
	name: string;
	schema: Record<string, unknown>;
};

export type CompletionRequest = {
	prompt: string;
	systemPrompt?: string;
	document?: ParseDocument;
	responseSchema?: ResponseSchema;
};

export type CompletionResult = {
	/** The model's text response - JSON, when a responseSchema was given. */
	text: string;
	/**
	 * The model that actually answered, which under provider routing is not
	 * necessarily the one requested.
	 */
	modelId: string;
	/** Upstream provider that served the request, where the API reports it. */
	servedBy?: string;
};

/**
 * A statement-parsing backend.
 *
 * The whole surface is one call. Statement parsing is a single-shot extraction
 * - document in, JSON out - with no conversation and no tool use, so anything
 * wider than this would be interface invented for a caller that does not exist.
 *
 * Implementations own their own failure translation: everything thrown from
 * `complete` must be an {@link LlmError} with a kind from the shared set, so
 * callers never have to know which provider is configured.
 */
export type StatementParsingProvider = {
	/** Stable identifier used in error messages and logs, e.g. "openrouter". */
	readonly name: string;
	/** The model this provider is configured to call. */
	readonly modelId: string;
	complete(request: CompletionRequest): Promise<CompletionResult>;
};

export type { LlmError };
