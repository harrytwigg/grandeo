import type { Config } from "drizzle-kit";

import { env } from "grandeo/env";

const getConfig = (): Config => {
	if (env.NODE_ENV === "production") {
		if (!env.DATABASE_AUTH_TOKEN) {
			throw new Error(
				"Missing DATABASE_AUTH_TOKEN in production environment. Please set it in your environment variables.",
			);
		}
		return {
			schema: "./src/server/db/schema.ts",
			dialect: "turso",
			dbCredentials: {
				url: env.DATABASE_URL,
				authToken: env.DATABASE_AUTH_TOKEN,
			},
			tablesFilter: ["grandeo_*"],
		};
	}

	return {
		schema: "./src/server/db/schema.ts",
		dialect: "sqlite",
		dbCredentials: {
			url: env.DATABASE_URL,
		},
		tablesFilter: ["grandeo_*"],
	};
};

export default getConfig();
