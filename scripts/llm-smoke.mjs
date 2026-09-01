/**
 * Smoke-check the statement-parsing path against the real provider.
 *
 * Makes one small call through the same SDK, model, routing pin and structured
 * output the app uses, so a key, model or routing problem shows up here rather
 * than as a failed statement upload in production.
 *
 *   node scripts/llm-smoke.mjs
 *
 * Reads OPENROUTER_API_KEY (required), OPENROUTER_MODEL_ID and
 * OPENROUTER_PROVIDER, defaulting to the same values as src/env.js.
 *
 * This exists because the integration it replaced shipped twice on a model ID
 * nobody had called. One run here is the difference between "the docs say this
 * works" and "this works".
 */
import { OpenRouter } from "@openrouter/sdk";

const apiKey = process.env.OPENROUTER_API_KEY;
const modelId = process.env.OPENROUTER_MODEL_ID || "z-ai/glm-5.3-flash";
const upstream = process.env.OPENROUTER_PROVIDER || "deepinfra";

if (!apiKey) {
	console.error("FAIL - OPENROUTER_API_KEY is not set. Nothing was tested.");
	process.exit(1);
}

console.log(`model:    ${modelId}`);
console.log(`provider: ${upstream} (pinned, no fallback)`);
console.log("endpoint: https://openrouter.ai/api/v1/chat/completions\n");

const client = new OpenRouter({ apiKey });

try {
	const result = await client.chat.send({
		chatRequest: {
			model: modelId,
			stream: false,
			maxTokens: 200,
			provider: { only: [upstream], allowFallbacks: false },
			responseFormat: {
				type: "json_schema",
				jsonSchema: {
					name: "smoke",
					schema: {
						type: "object",
						properties: { ok: { type: "boolean" } },
						required: ["ok"],
						additionalProperties: false,
					},
				},
			},
			messages: [
				{
					role: "user",
					content: 'Reply with JSON: {"ok": true}',
				},
			],
		},
	});

	const choice = result.choices?.[0];
	const text = choice?.message?.content;

	console.log(`PASS - served by ${result.model}`);
	console.log(
		`reply:  ${typeof text === "string" ? text.trim() : "(non-text)"}`,
	);
	console.log(`finish: ${choice?.finishReason}`);
	if (result.usage) {
		console.log(`usage:  ${JSON.stringify(result.usage)}`);
	}
} catch (error) {
	const status = error?.statusCode ?? error?.status;
	console.error(
		`FAIL - ${error?.name ?? "Error"}${status ? ` (${status})` : ""}`,
	);
	console.error(`  ${error?.message ?? error}`);

	if (status === 401) {
		console.error("\nOPENROUTER_API_KEY is missing, wrong or revoked.");
	} else if (status === 402) {
		console.error("\nThe OpenRouter account is out of credit.");
	} else if (status === 404) {
		console.error(
			`\nNo such model "${modelId}". Check the slug at https://openrouter.ai/models.`,
		);
	} else if (status === 400) {
		console.error(
			`\nCheck that "${upstream}" serves this model and supports structured outputs:`,
		);
		console.error(
			`  curl -s https://openrouter.ai/api/v1/models/${modelId}/endpoints`,
		);
	}

	process.exitCode = 1;
}
