import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import {
	currentAccounts,
	expenseCategories,
	transactionSplits,
	transactions,
} from "grandeo/server/db/schema";
import { z } from "zod";

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

	// New endpoint to calculate owed balance for an account (including manual splits)
	getOwedBalanceByAccountId: publicProcedure
		.input(z.object({ accountId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get all splits where the source transaction is from this account
			// but the split is allocated to a different account (money this account owes)
			const owedByThisAccountFromTransactions = await ctx.db
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

			// Get all splits where other accounts' transactions are split to this account
			// (money others owe to this account)
			const owedToThisAccountFromTransactions = await ctx.db
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
						eq(transactionSplits.currentAccountId, input.accountId),
						ne(transactions.currentAccountId, input.accountId),
					),
				);

			// Get manual splits where this account sends money to other accounts
			// (money this account owes from manual splits)
			const owedByThisAccountFromManualSplits = await ctx.db
				.select({
					totalOwed: sql<number>`COALESCE(SUM(${transactionSplits.amountInPounds}), 0)`,
				})
				.from(transactionSplits)
				.where(
					and(
						eq(transactionSplits.sourceAccountId, input.accountId),
						ne(transactionSplits.currentAccountId, input.accountId),
						sql`${transactionSplits.sourceTransactionId} IS NULL`, // Manual splits have no source transaction
					),
				);

			// Get manual splits where other accounts send money to this account
			// (money others owe to this account from manual splits)
			const owedToThisAccountFromManualSplits = await ctx.db
				.select({
					totalOwed: sql<number>`COALESCE(SUM(${transactionSplits.amountInPounds}), 0)`,
				})
				.from(transactionSplits)
				.where(
					and(
						eq(transactionSplits.currentAccountId, input.accountId),
						ne(transactionSplits.sourceAccountId, input.accountId),
						sql`${transactionSplits.sourceTransactionId} IS NULL`, // Manual splits have no source transaction
					),
				);

			const totalOwedByThisFromTransactions =
				owedByThisAccountFromTransactions[0]?.totalOwed || 0;
			const totalOwedToThisFromTransactions =
				owedToThisAccountFromTransactions[0]?.totalOwed || 0;
			const totalOwedByThisFromManualSplits =
				owedByThisAccountFromManualSplits[0]?.totalOwed || 0;
			const totalOwedToThisFromManualSplits =
				owedToThisAccountFromManualSplits[0]?.totalOwed || 0;

			const totalOwedByThis =
				totalOwedByThisFromTransactions + totalOwedByThisFromManualSplits;
			const totalOwedToThis =
				totalOwedToThisFromTransactions + totalOwedToThisFromManualSplits;

			// Return net balance: positive means others owe this account, negative means this account owes others
			return totalOwedToThis - totalOwedByThis;
		}),

	// Get all transaction splits involving an account (including manual splits)
	getSplitsByAccountId: publicProcedure
		.input(z.object({ accountId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get splits where:
			// 1. The split is TO this account (from another account's transaction or manual split)
			// 2. The split is FROM this account's transaction TO another account
			// 3. Manual splits where this account is the source account
			// But exclude splits on the same account
			const allSplits = await ctx.db
				.select({
					id: transactionSplits.id,
					sourceTransactionId: transactionSplits.sourceTransactionId,
					sourceAccountId: transactionSplits.sourceAccountId,
					currentAccountId: transactionSplits.currentAccountId,
					amountInPounds: transactionSplits.amountInPounds,
					description: transactionSplits.description,
					createdAt: transactionSplits.createdAt,
					currentAccount: {
						id: currentAccounts.id,
						name: currentAccounts.name,
						accountType: currentAccounts.accountType,
					},
					sourceTransaction: {
						id: transactions.id,
						description: transactions.description,
						date: transactions.date,
						amountInPounds: transactions.amountInPounds,
						currentAccountId: transactions.currentAccountId,
					},
				})
				.from(transactionSplits)
				.leftJoin(
					currentAccounts,
					eq(transactionSplits.currentAccountId, currentAccounts.id),
				)
				.leftJoin(
					transactions,
					eq(transactionSplits.sourceTransactionId, transactions.id),
				)
				.orderBy(desc(transactionSplits.createdAt));

			// Get source accounts for manual splits separately
			const splitsWithSourceAccounts = await Promise.all(
				allSplits.map(async (split) => {
					if (split.sourceAccountId) {
						const sourceAccount = await ctx.db
							.select({
								id: currentAccounts.id,
								name: currentAccounts.name,
								accountType: currentAccounts.accountType,
							})
							.from(currentAccounts)
							.where(eq(currentAccounts.id, split.sourceAccountId))
							.limit(1);

						return {
							...split,
							sourceAccount: sourceAccount[0] || null,
						};
					}
					return {
						...split,
						sourceAccount: null,
					};
				}),
			);

			// Filter to include only splits involving this account but exclude self-splits
			return splitsWithSourceAccounts.filter((split) => {
				const isToThisAccount = split.currentAccountId === input.accountId;
				const isFromThisAccount =
					split.sourceTransaction?.currentAccountId === input.accountId;
				const isManualSplitFromThisAccount =
					split.sourceAccountId === input.accountId;
				const isSelfSplit =
					split.currentAccountId ===
						split.sourceTransaction?.currentAccountId ||
					split.currentAccountId === split.sourceAccountId;

				return (
					(isToThisAccount ||
						isFromThisAccount ||
						isManualSplitFromThisAccount) &&
					!isSelfSplit
				);
			});
		}),

	// Create a manual split between accounts
	createManualSplit: publicProcedure
		.input(
			z.object({
				sourceAccountId: z.string(),
				targetAccountId: z.string(),
				amount: z.number().positive(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { sourceAccountId, targetAccountId, amount, description } = input;

			// Validate that accounts exist
			const [sourceAccount, targetAccount] = await Promise.all([
				ctx.db
					.select()
					.from(currentAccounts)
					.where(eq(currentAccounts.id, sourceAccountId))
					.limit(1),
				ctx.db
					.select()
					.from(currentAccounts)
					.where(eq(currentAccounts.id, targetAccountId))
					.limit(1),
			]);

			if (sourceAccount.length === 0) {
				throw new Error("Source account not found");
			}
			if (targetAccount.length === 0) {
				throw new Error("Target account not found");
			}
			if (sourceAccountId === targetAccountId) {
				throw new Error("Source and target accounts cannot be the same");
			}

			// Create the manual split
			const result = await ctx.db
				.insert(transactionSplits)
				.values({
					sourceAccountId,
					currentAccountId: targetAccountId,
					amountInPounds: amount,
					description,
				})
				.returning();

			return result[0];
		}),
});
