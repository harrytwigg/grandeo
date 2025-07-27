import { z } from "zod";

import { eq, and } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import { expenseCategories } from "grandeo/server/db/schema";

export const expenseCategoriesRouter = createTRPCRouter({
	getAll: publicProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(expenseCategories)
				.where(eq(expenseCategories.workspaceId, input.workspaceId));
		}),

	getById: publicProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(expenseCategories)
				.where(
					and(
						eq(expenseCategories.id, input.id),
						eq(expenseCategories.workspaceId, input.workspaceId),
					),
				)
				.limit(1);
		}),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required").trim().toLowerCase(),
				workspaceId: z.string(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(expenseCategories).values({
				name: input.name,
				workspaceId: input.workspaceId,
			});
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required"),
				workspaceId: z.string(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db
				.update(expenseCategories)
				.set({
					name: input.name,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(expenseCategories.id, input.id),
						eq(expenseCategories.workspaceId, input.workspaceId),
					),
				);
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(expenseCategories)
				.where(
					and(
						eq(expenseCategories.id, input.id),
						eq(expenseCategories.workspaceId, input.workspaceId),
					),
				);
		}),
});
