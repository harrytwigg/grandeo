import type { Config } from "drizzle-kit";

import { env } from "grandeo/env";

export default {
	schema: "./src/server/db/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	tablesFilter: ["grandeo_*"],
} satisfies Config;
