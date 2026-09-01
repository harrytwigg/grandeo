/**
 * Find which Bedrock model ID actually resolves, without deploying.
 *
 * Two model IDs have failed in production with a 404 - the bare
 * `anthropic.claude-sonnet-5` and the EU-profile `eu.anthropic.claude-sonnet-5`
 * - and a 404 alone does not say whether the ID is wrong, the region is wrong,
 * or the account has no access. This probes candidates across a region in one
 * run and reports each outcome separately, so one run settles it.
 *
 *   node scripts/bedrock-probe.mjs
 *   node scripts/bedrock-probe.mjs eu-west-1          # try another region
 *   node scripts/bedrock-probe.mjs eu-west-2 anthropic.claude-haiku-4-5
 *
 * Reads BEDROCK_REGION (default eu-west-1). Credentials resolve through the
 * standard AWS chain. Each probe is a 1-token call, so a full run costs
 * fractions of a cent.
 *
 * How to read the result:
 *   OK           - this ID works. Set BEDROCK_MODEL_ID to it.
 *   404          - Bedrock does not know this ID in this region.
 *   403          - the ID is real, but this account lacks model access or the
 *                  caller lacks bedrock-mantle:CreateInference. Not an ID bug.
 *   401          - no usable AWS credentials; nothing below is meaningful.
 *
 * If every candidate returns 404, the ID is not the problem - see the AWS CLI
 * commands printed at the end.
 */
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";

const region = process.argv[2] || process.env.BEDROCK_REGION || "eu-west-1";

// Probed against the real account on 2026-09-01: the bare `anthropic.` form is
// the only one that resolves anywhere, and it resolves only in regions marked
// "In-region only" in Anthropic's region table (eu-west-1, us-east-1 - not
// eu-west-2 or eu-central-1). The prefixed forms are kept in the list so a
// future run re-checks that rather than trusting this comment.
const candidates =
	process.argv.length > 3
		? process.argv.slice(3)
		: [
				"global.anthropic.claude-sonnet-5",
				"eu.anthropic.claude-sonnet-5",
				"anthropic.claude-sonnet-5",
				"global.anthropic.claude-haiku-4-5",
				"eu.anthropic.claude-haiku-4-5",
			];

console.log(`region:   ${region}`);
console.log(`endpoint: https://bedrock-mantle.${region}.api.aws/anthropic`);
console.log(`probing:  ${candidates.length} candidate model IDs\n`);

const client = new AnthropicBedrockMantle({ awsRegion: region });

/** @param {string} modelId */
const probe = async (modelId) => {
	try {
		await client.messages.create({
			model: modelId,
			max_tokens: 1,
			messages: [{ role: "user", content: "hi" }],
		});
		return { status: "OK", detail: "model replied" };
	} catch (error) {
		if (error instanceof Anthropic.NotFoundError) {
			return { status: "404", detail: "no such model in this region" };
		}
		if (error instanceof Anthropic.PermissionDeniedError) {
			return {
				status: "403",
				detail: "ID is valid - model access or IAM is missing",
			};
		}
		if (error instanceof Anthropic.AuthenticationError) {
			return { status: "401", detail: "no usable AWS credentials" };
		}
		return { status: "ERR", detail: error?.message ?? String(error) };
	}
};

const results = [];
for (const modelId of candidates) {
	const result = await probe(modelId);
	results.push({ modelId, ...result });
	console.log(
		`  ${result.status.padEnd(4)}  ${modelId.padEnd(38)}  ${result.detail}`,
	);
}

const working = results.filter((r) => r.status === "OK");
const reachable = results.filter((r) => r.status === "403");

console.log("");
if (working.length > 0) {
	console.log("Set BEDROCK_MODEL_ID to one of:");
	for (const r of working) console.log(`  ${r.modelId}`);
} else if (reachable.length > 0) {
	console.log(
		"No ID returned a completion, but these are real IDs the account cannot yet use:",
	);
	for (const r of reachable) console.log(`  ${r.modelId}`);
	console.log(
		"\nThis is a model-access or IAM problem, not a model-ID problem. Enable the",
	);
	console.log(
		"model under Bedrock > Model access in this region, then re-run.",
	);
} else if (results.every((r) => r.status === "401")) {
	console.log("No usable AWS credentials - nothing was actually tested.");
} else {
	console.log(
		"Every candidate 404'd. The model ID is not the problem. Check what",
	);
	console.log("this account can actually see in this region:\n");
	console.log(`  aws bedrock list-foundation-models --region ${region} \\`);
	console.log(
		'    --by-provider anthropic --query "modelSummaries[*].modelId"',
	);
	console.log(`  aws bedrock list-inference-profiles --region ${region}`);
	console.log(
		'\nNote eu-west-1 (Ireland) is the nearest EU region marked "In-region only",',
	);
	console.log("so it accepts a bare ID with no inference profile.");
}

process.exitCode = working.length > 0 ? 0 : 1;
