import { z } from "zod";

import { and, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import { currentAccounts } from "grandeo/server/db/schema";

export const currentAccountsRouter = createTRPCRouter({
	getAll: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(currentAccounts)
				.where(eq(currentAccounts.workspaceId, input.workspaceId));
		}),

	getById: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(currentAccounts)
				.where(
					and(
						eq(currentAccounts.id, input.id),
						eq(currentAccounts.workspaceId, input.workspaceId),
					),
				)
				.limit(1);
		}),

	create: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				name: z.string().min(1, "Name is required").trim().toLowerCase(),
				accountType: z
					.enum(["current_account", "credit_card"])
					.default("current_account"),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(currentAccounts).values({
				workspaceId: input.workspaceId,
				name: input.name,
				accountType: input.accountType,
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				name: z.string().min(1, "Name is required"),
				accountType: z.enum(["current_account", "credit_card"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify account belongs to user's workspace
			const account = await ctx.db
				.select()
				.from(currentAccounts)
				.where(
					and(
						eq(currentAccounts.id, input.id),
						eq(currentAccounts.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (account.length === 0) {
				throw new Error("Account not found or access denied");
			}

			const updateData: {
				name: string;
				updatedAt: Date;
				accountType?: "current_account" | "credit_card";
			} = {
				name: input.name,
				updatedAt: new Date(),
			};

			if (input.accountType) {
				updateData.accountType = input.accountType;
			}

			return ctx.db
				.update(currentAccounts)
				.set(updateData)
				.where(eq(currentAccounts.id, input.id));
		}),

	delete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify account belongs to user's workspace
			const account = await ctx.db
				.select()
				.from(currentAccounts)
				.where(
					and(
						eq(currentAccounts.id, input.id),
						eq(currentAccounts.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (account.length === 0) {
				throw new Error("Account not found or access denied");
			}

			return ctx.db
				.delete(currentAccounts)
				.where(eq(currentAccounts.id, input.id));
		}),
});
