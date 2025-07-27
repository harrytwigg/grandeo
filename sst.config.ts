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

    // Verify env setup
    await import("grandeo/env");

		new sst.aws.Nextjs("Website", {
			warm: 5,
			domain: {
				name: coreEnv.DOMAIN_NAME,
				redirects: [`www.${coreEnv.DOMAIN_NAME}`],
				dns: sst.cloudflare.dns(),
			},
			environment: {
				DOMAIN_NAME: coreEnv.DOMAIN_NAME,
			},
			
		});
	},
});
