import { ResultAsync } from "neverthrow";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LlmError, isLlmError } from "./errors";
import { openRouterProvider } from "./openrouter";
import type { StatementParsingProvider } from "./provider";

export { LlmError, isLlmError } from "./errors";
export type { LlmFailureKind } from "./errors";
export type {
	CompletionRequest,
	CompletionResult,
	ParseDocument,
	ResponseSchema,
	StatementParsingProvider,
} from "./provider";

/**
 * The configured statement-parsing backend.
 *
 * One entry today. It is a lookup rather than a direct import so that adding a
 * provider is a new file plus a line here, and so the rest of the app never
 * imports a provider module directly - which is what let the previous
 * Bedrock-specific error type leak all the way into the tRPC router.
 */
const PROVIDERS: Record<string, StatementParsingProvider> = {
	openrouter: openRouterProvider,
};

const provider = openRouterProvider;

/** The backend statement parsing will use, for diagnostics and smoke tests. */
export const activeProvider = (): StatementParsingProvider => provider;

export const availableProviders = (): string[] => Object.keys(PROVIDERS);

/**
 * Send a document and prompt to the configured model and return its raw text.
 *
 * @returns ResultAsync<string, Error> - the model's response, or an LlmError
 * that already explains what to do about the failure.
 */
export const processFileWithModel = ({
	prompt,
	fileBuffer,
	fileName,
	mimeType,
	systemPrompt,
	responseSchema,
}: {
	prompt: string;
	fileBuffer: Buffer;
	fileName: string;
	mimeType: string;
	systemPrompt?: string;
	responseSchema?: { name: string; schema: Record<string, unknown> };
}): ResultAsync<string, Error> =>
	ResultAsync.fromPromise(
		provider
			.complete({
				prompt: `${prompt}\n\nFile: ${fileName}\nMIME Type: ${mimeType}`,
				systemPrompt,
				document: {
					fileName,
					mimeType,
					content: fileBuffer.toString("base64"),
				},
				responseSchema,
			})
			.then((result) => result.text),
		// An LlmError already says what went wrong and what to do about it -
		// re-wrapping it here is what produced the old quadruple-prefixed 500.
		(error) =>
			isLlmError(error)
				? error
				: new LlmError({
						kind: "unknown",
						provider: provider.name,
						modelId: provider.modelId,
						message: `Statement parsing failed: ${
							error instanceof Error ? error.message : String(error)
						}`,
						cause: error,
					}),
	);

/**
 * Process a file and validate the response against a Zod schema.
 *
 * The schema is sent to the provider as JSON Schema *and* described in the
 * prompt. Providers differ in whether they enforce `response_format`, and a
 * model that ignores it still tends to follow a schema it was shown - so the
 * belt-and-braces is deliberate. The Zod parse at the end is what actually
 * guarantees the shape.
 *
 * @returns ResultAsync<T, Error> - the parsed and validated response or error
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
			// `$refStrategy: "none"` inlines every definition. Providers that
			// enforce structured outputs generally reject `$ref`/`definitions`, and
			// a statement schema is small enough that inlining costs nothing.
			const jsonSchema = zodToJsonSchema(schema, {
				$refStrategy: "none",
			}) as Record<string, unknown>;

			const enhancedPrompt = `${prompt}

Please respond with a valid JSON object that matches this exact schema:

${JSON.stringify(jsonSchema, null, 2)}

Important:
- Respond ONLY with the JSON object, no additional text
- Ensure the response is valid JSON
- Follow the schema structure exactly`;

			const result = await processFileWithModel({
				prompt: enhancedPrompt,
				fileBuffer,
				fileName,
				mimeType,
				responseSchema: { name: "statement", schema: jsonSchema },
				systemPrompt:
					"You are a precise data extraction specialist. Your job is to analyze documents and extract structured data according to the provided schema. Always respond with valid JSON that exactly matches the requested format. Do not include any explanatory text, only the JSON response.",
			});

			if (result.isErr()) {
				throw result.error;
			}

			const response = result.value;

			let parsedResponse: unknown;
			try {
				parsedResponse = JSON.parse(response);
			} catch {
				// Models that reason in prose before answering wrap the JSON in text,
				// and some emit it inside a ``` fence. Take the outermost object.
				const jsonMatch = response.match(/\{[\s\S]*\}/);
				if (jsonMatch?.[0]) {
					parsedResponse = JSON.parse(jsonMatch[0]);
				} else {
					throw new LlmError({
						kind: "unknown",
						provider: provider.name,
						modelId: provider.modelId,
						message: `The model returned no JSON for this document. Response began: ${response.slice(0, 200)}`,
					});
				}
			}

			return schema.parse(parsedResponse);
		})(),
		(error) =>
			isLlmError(error)
				? error
				: new Error(
						`Error processing file with schema: ${
							error instanceof Error ? error.message : String(error)
						}`,
						{ cause: error },
					),
	);
};
