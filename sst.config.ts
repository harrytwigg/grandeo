// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	async app(input) {
		const { coreEnv, getCoreEnvSecret } = await import(
			"./infrastructure/core-env"
		);

		return {
			name: "grandeo",
			removal: input.stage === "production" ? "retain" : "remove",
			protect: ["production"].includes(input?.stage),
			home: "aws",
			providers: {
				aws: {
					region: coreEnv.AWS_REGION,
					profile: coreEnv.AWS_PROFILE,
				},
				cloudflare: {
					version: "6.2.0",
					apiToken: getCoreEnvSecret("CLOUDFLARE_API_TOKEN", true),
				},
			},
		};
	},
	async run() {
		console.log("Running sst deployment...");

		const { coreEnv } = await import("./infrastructure/core-env");

		if (coreEnv.SUDO_STACK === "infrastructure") {
			console.log("Sudo stack is infrastructure, skipping website deployment");

			const { createPipeline } = await import("./infrastructure/pipeline");
			await createPipeline();
			return;
		}

		console.log("Sudo stack is website, deploying website...");

		const bucket = new aws.s3.Bucket(`grandeo-data-${coreEnv.BRANCH}`);

		new sst.aws.Nextjs("Website", {
			warm: 0,
			domain: {
				name: coreEnv.DOMAIN_NAME,
				redirects: [`www.${coreEnv.DOMAIN_NAME}`],
				dns: sst.cloudflare.dns(),
			},
			server: {
				timeout: "120 seconds",
			},
			// Env var validation handled in the build process
			environment: {
				DOMAIN_NAME: coreEnv.DOMAIN_NAME,
				DATA_BUCKET_NAME: bucket.bucket,
				CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
				DATABASE_URL: process.env.DATABASE_URL ?? "",
				DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN ?? "",
				// Required - statement parsing cannot run without it.
				OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
				// Optional. Empty falls back to src/env.js - the default model, and
				// unpinned provider routing - so both can be changed without a
				// code change.
				OPENROUTER_MODEL_ID: process.env.OPENROUTER_MODEL_ID ?? "",
				OPENROUTER_PROVIDER: process.env.OPENROUTER_PROVIDER ?? "",
			},
			permissions: [
				// No Bedrock, bedrock-mantle or AWS Marketplace grants: statement
				// parsing now leaves AWS entirely and authenticates to OpenRouter
				// with OPENROUTER_API_KEY. Three separate IAM/entitlement grants
				// stopped being part of the parsing path with that change.
				// read write to the bucket
				{
					effect: "allow",
					actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
					resources: [bucket.arn, bucket.arn.apply((arn) => `${arn}/*`)],
				},
			],
		});
	},
});
