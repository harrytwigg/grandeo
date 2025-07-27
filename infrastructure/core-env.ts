import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import * as pulumi from "@pulumi/pulumi";
import { config } from "dotenv";

config({
  path: ".env.local",
});

export const coreEnv = createEnv({
  server: {
    BRANCH: z.string(),
    DOMAIN_NAME: z.string(),
    AWS_PROFILE: z.string().optional(),
    AWS_REGION: z.string().default("eu-west-2"),
    GITHUB_OWNER: z.string(),
    GITHUB_REPO: z.string(),
    SUDO_STACK: z.enum(["infrastructure", "website"]),
  },
  runtimeEnv: process.env,
});

const coreEnvSecrets = createEnv({
  server: {
    CLOUDFLARE_API_TOKEN: z.string(),
    GITHUB_OAUTH_TOKEN: z.string(),
  },
  runtimeEnv: process.env,
});

export const getCoreEnvSecret = <Key extends keyof typeof coreEnvSecrets>(
  key: Key,
  dangerousClearText = false,
) => {
  if (!coreEnvSecrets[key]) {
    throw new Error(`Missing environment variable: ${String(key)}`);
  }

  if (dangerousClearText) {
    return coreEnvSecrets[key];
  }

  return pulumi.secret(coreEnvSecrets[key]);
};
