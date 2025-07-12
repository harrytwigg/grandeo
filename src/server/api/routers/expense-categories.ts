import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import { expenseCategories } from "grandeo/server/db/schema";
import { eq } from "drizzle-orm";

export const expenseCategoriesRouter = createTRPCRouter({
	getAll: publicProcedure.query(({ ctx }) => {
		return ctx.db.select().from(expenseCategories);
	}),

	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(expenseCategories)
				.where(eq(expenseCategories.id, input.id))
				.limit(1);
		}),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required").trim().toLowerCase(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(expenseCategories).values({
				name: input.name,
			});
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required"),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db
				.update(expenseCategories)
				.set({
					name: input.name,
					updatedAt: new Date(),
				})
				.where(eq(expenseCategories.id, input.id));
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(expenseCategories)
				.where(eq(expenseCategories.id, input.id));
		}),
});
