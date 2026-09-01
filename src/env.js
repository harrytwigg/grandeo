import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z.string().url(),
		DATABASE_AUTH_TOKEN: z
			.string()
			.optional()
			.refine(
				(value) => {
					if (process.env.NODE_ENV === "production" && !value) {
						return false;
					}
					// in production, it can be optional
					return true;
				},
				{
					message: "DATABASE_AUTH_TOKEN is required in production",
				},
			),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		DATA_BUCKET_NAME: z.string(),
		AWS_REGION: z.string().default("eu-west-2"),
		// Statement parsing runs through OpenRouter. Unlike the Bedrock path this
		// replaced, there is no region and no per-account model entitlement to
		// get right - a key and a model slug are the whole configuration.
		OPENROUTER_API_KEY: z.string(),
		// OpenRouter model slug, "<author>/<slug>" - see https://openrouter.ai/models.
		// Overridable so the model can be changed without a code deploy.
		OPENROUTER_MODEL_ID: z.string().default("z-ai/glm-5.3-flash"),
		// Upstream provider OpenRouter is allowed to route to. Pinned rather than
		// preferred: src/server/llm/openrouter.ts sets allowFallbacks:false, so a
		// request never silently lands at a provider nobody chose. DeepInfra is
		// US-hosted and serves this model with structured-output support.
		OPENROUTER_PROVIDER: z.string().default("deepinfra"),
		CLERK_SECRET_KEY: z.string(),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
		NODE_ENV: process.env.NODE_ENV,
		DATA_BUCKET_NAME: process.env.DATA_BUCKET_NAME,
		AWS_REGION: process.env.AWS_REGION,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_MODEL_ID: process.env.OPENROUTER_MODEL_ID,
		OPENROUTER_PROVIDER: process.env.OPENROUTER_PROVIDER,
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
