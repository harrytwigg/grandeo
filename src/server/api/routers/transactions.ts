import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import {
	transactions,
	expenseCategories,
	transactionSplits,
	currentAccounts,
} from "grandeo/server/db/schema";
import { eq, desc, sql, ne, and } from "drizzle-orm";

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

	// New endpoints for transaction splits
	createSplits: publicProcedure
		.input(
			z.object({
				sourceTransactionId: z.string(),
				splits: z
					.array(
						z.object({
							currentAccountId: z.string(),
							amountInPounds: z.number(),
							description: z.string().nullable().optional(),
						}),
					)
					.min(1, "At least one split is required"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Validate that split amounts sum to the original transaction amount
			const sourceTransaction = await ctx.db
				.select({ amountInPounds: transactions.amountInPounds })
				.from(transactions)
				.where(eq(transactions.id, input.sourceTransactionId))
				.limit(1);

			if (!sourceTransaction[0]) {
				throw new Error("Source transaction not found");
			}

			const totalSplitAmount = input.splits.reduce(
				(sum, split) => sum + split.amountInPounds,
				0,
			);

			if (
				Math.abs(totalSplitAmount - sourceTransaction[0].amountInPounds) > 0.01
			) {
				throw new Error(
					`Split amounts (${totalSplitAmount}) must sum to the original transaction amount (${sourceTransaction[0].amountInPounds})`,
				);
			}

			// Insert all splits
			return ctx.db.insert(transactionSplits).values(
				input.splits.map((split) => ({
					sourceTransactionId: input.sourceTransactionId,
					currentAccountId: split.currentAccountId,
					amountInPounds: split.amountInPounds,
					description: split.description,
				})),
			);
		}),

	getSplitsByTransactionId: publicProcedure
		.input(z.object({ transactionId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select({
					id: transactionSplits.id,
					sourceTransactionId: transactionSplits.sourceTransactionId,
					currentAccountId: transactionSplits.currentAccountId,
					amountInPounds: transactionSplits.amountInPounds,
					description: transactionSplits.description,
					currentAccount: {
						id: currentAccounts.id,
						name: currentAccounts.name,
						accountType: currentAccounts.accountType,
					},
				})
				.from(transactionSplits)
				.leftJoin(
					currentAccounts,
					eq(transactionSplits.currentAccountId, currentAccounts.id),
				)
				.where(eq(transactionSplits.sourceTransactionId, input.transactionId));
		}),

	deleteSplit: publicProcedure
		.input(z.object({ splitId: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(transactionSplits)
				.where(eq(transactionSplits.id, input.splitId));
		}),

	deleteAllSplits: publicProcedure
		.input(z.object({ transactionId: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(transactionSplits)
				.where(eq(transactionSplits.sourceTransactionId, input.transactionId));
		}),

	// New endpoint to calculate owed balance for an account
	getOwedBalanceByAccountId: publicProcedure
		.input(z.object({ accountId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get all splits where the source transaction is from this account
			// but the split is allocated to a different account
			const result = await ctx.db
				.select({
					totalOwed: sql<number>`COALESCE(SUM(${transactionSplits.amountInPounds}), 0)`,
				})
				.from(transactionSplits)
				.innerJoin(
					transactions,
					eq(transactionSplits.sourceTransactionId, transactions.id),
				)
				.where(
					and(
						eq(transactions.currentAccountId, input.accountId),
						ne(transactionSplits.currentAccountId, input.accountId),
					),
				);

			return -(result[0]?.totalOwed || 0);
		}),
});
