/**
 * Why a statement-parsing call failed, in terms the caller can act on.
 *
 * These kinds are provider-agnostic on purpose. `toParseError` in the
 * statements router switches on them to pick an HTTP status, so a new provider
 * has to map its own failures onto this set rather than inventing its own -
 * that is what keeps the router from growing a branch per provider.
 */
export type LlmFailureKind =
	| "access-denied"
	| "invalid-request"
	| "rate-limited"
	| "unavailable"
	| "response-truncated"
	| "refused"
	| "unknown";

/**
 * A statement-parsing failure carrying an actionable message.
 *
 * The helpers re-throw this untouched rather than wrapping it, so the reason
 * survives the call chain instead of arriving at the API layer behind several
 * layers of `Error:` prefixes.
 *
 * `provider` and `modelId` are carried so a message can name what actually ran.
 * With routing in play, the model asked for and the model that answered are not
 * always the same thing, and a failure that does not say which is which is very
 * hard to act on.
 */
export class LlmError extends Error {
	readonly kind: LlmFailureKind;
	readonly provider: string;
	readonly modelId: string;

	constructor({
		kind,
		message,
		provider,
		modelId,
		cause,
	}: {
		kind: LlmFailureKind;
		message: string;
		provider: string;
		modelId: string;
		cause?: unknown;
	}) {
		super(message, { cause });
		this.name = "LlmError";
		this.kind = kind;
		this.provider = provider;
		this.modelId = modelId;
	}
}

/** True for an error that already carries an actionable reason. */
export const isLlmError = (error: unknown): error is LlmError =>
	error instanceof LlmError;
