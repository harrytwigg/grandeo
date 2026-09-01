/**
 * Smoke-check the Bedrock statement-parsing path against real AWS.
 *
 * Makes one tiny call through the same client, endpoint and model ID the app
 * uses, so a model or permissions problem shows up here rather than as a failed
 * statement upload in production. Diagnoses the two failures this integration
 * has actually hit.
 *
 *   node scripts/bedrock-smoke.mjs
 *
 * Reads AWS_REGION and BEDROCK_MODEL_ID from the environment, defaulting to the
 * same values as src/env.js. Credentials resolve through the standard AWS
 * chain, so an `aws sso login` / profile / env-var setup is all it needs.
 */
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";

const region = process.env.AWS_REGION || "eu-west-2";
const modelId = process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-5";

console.log(`region:   ${region}`);
console.log(`model:    ${modelId}`);
console.log(`endpoint: https://bedrock-mantle.${region}.api.aws/anthropic\n`);

const client = new AnthropicBedrockMantle({ awsRegion: region });

try {
	const message = await client.messages.create({
		model: modelId,
		max_tokens: 64,
		messages: [{ role: "user", content: "Reply with the single word: ok" }],
	});
	const text = message.content.find((block) => block.type === "text")?.text;
	console.log(`PASS - model replied: ${JSON.stringify(text)}`);
	console.log(`usage: ${JSON.stringify(message.usage)}`);
} catch (error) {
	if (error instanceof Anthropic.PermissionDeniedError) {
		console.error(`FAIL - access denied for "${modelId}" in ${region}.`);
		console.error("Check both of these - they produce the same error:");
		console.error(
			"  1. Model access: AWS Console > Bedrock > Model access, in this region.",
		);
		console.error(
			'  2. IAM: the calling principal needs "bedrock-mantle:CreateInference".',
		);
		console.error(
			'     "bedrock:*" does NOT grant it - it is a separate service namespace.',
		);
	} else if (error instanceof Anthropic.NotFoundError) {
		console.error(`FAIL - no such model "${modelId}" in ${region}.`);
		console.error(
			'Model IDs take an "anthropic." prefix, with no geo prefix and no version suffix.',
		);
		console.error(
			'e.g. "anthropic.claude-sonnet-5". Region comes from AWS_REGION, not the ID.',
		);
	} else if (error instanceof Anthropic.BadRequestError) {
		console.error(`FAIL - Bedrock rejected the request: ${error.message}`);
	} else {
		console.error(`FAIL - ${error?.message ?? error}`);
	}
	process.exitCode = 1;
}
