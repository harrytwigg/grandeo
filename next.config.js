/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	devIndicators: false,
	// skip lint type check
	typescript: {
		ignoreBuildErrors: true,
	},
	// skip lint type check
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default config;
