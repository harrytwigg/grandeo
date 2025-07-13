import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import { transactions, expenseCategories } from "grandeo/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const transactionsRouter = createTRPCRouter({
	getByAccountId: publicProcedure
		.input(z.object({ accountId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select({
					id: transactions.id,
					currentAccountId: transactions.currentAccountId,
					expenseCategoryId: transactions.expenseCategoryId,
					amountInPounds: transactions.amountInPounds,
					description: transactions.description,
					date: transactions.date,
					handled: transactions.handled,
					createdAt: transactions.createdAt,
					updatedAt: transactions.updatedAt,
					expenseCategory: {
						id: expenseCategories.id,
						name: expenseCategories.name,
					},
				})
				.from(transactions)
				.leftJoin(
					expenseCategories,
					eq(transactions.expenseCategoryId, expenseCategories.id),
				)
				.where(eq(transactions.currentAccountId, input.accountId))
				.orderBy(desc(transactions.date));
		}),

	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select({
					id: transactions.id,
					currentAccountId: transactions.currentAccountId,
					expenseCategoryId: transactions.expenseCategoryId,
					amountInPounds: transactions.amountInPounds,
					description: transactions.description,
					date: transactions.date,
					handled: transactions.handled,
					createdAt: transactions.createdAt,
					updatedAt: transactions.updatedAt,
					expenseCategory: {
						id: expenseCategories.id,
						name: expenseCategories.name,
					},
				})
				.from(transactions)
				.leftJoin(
					expenseCategories,
					eq(transactions.expenseCategoryId, expenseCategories.id),
				)
				.where(eq(transactions.id, input.id))
				.limit(1);
		}),

	updateExpenseCategory: publicProcedure
		.input(
			z.object({
				id: z.string(),
				expenseCategoryId: z.string().nullable(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db
				.update(transactions)
				.set({
					expenseCategoryId: input.expenseCategoryId,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id));
		}),

	updateHandled: publicProcedure
		.input(
			z.object({
				id: z.string(),
				handled: z.boolean(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db
				.update(transactions)
				.set({
					handled: input.handled,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id));
		}),
});
