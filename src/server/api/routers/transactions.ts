import { and, count, desc, eq, ne, or, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import {
	currentAccounts,
	expenseCategories,
	transactionSplits,
	transactions,
} from "grandeo/server/db/schema";
import { z } from "zod";

export const transactionsRouter = createTRPCRouter({
	getByAccountId: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				workspaceId: z.string(),
				page: z.number().min(1).default(1),
				pageSize: z.number().min(1).max(100).default(20),
				handled: z.enum(["all", "handled", "unhandled"]).default("all"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const offset = (input.page - 1) * input.pageSize;

			// Build where conditions
			const whereConditions = [
				eq(transactions.currentAccountId, input.accountId),
				eq(transactions.workspaceId, input.workspaceId),
			];

			if (input.handled === "handled") {
				whereConditions.push(eq(transactions.handled, true));
			} else if (input.handled === "unhandled") {
				whereConditions.push(eq(transactions.handled, false));
			}

			// Get total count
			const totalCount = await ctx.db
				.select({ count: count() })
				.from(transactions)
				.where(and(...whereConditions));

			// Get paginated transactions
			const transactionsList = await ctx.db
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
				.where(and(...whereConditions))
				.orderBy(desc(transactions.date))
				.limit(input.pageSize)
				.offset(offset);

			const total = totalCount[0]?.count || 0;
			const totalPages = Math.ceil(total / input.pageSize);

			return {
				transactions: transactionsList,
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					total,
					totalPages,
					hasNext: input.page < totalPages,
					hasPrev: input.page > 1,
				},
			};
		}),

	getById: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const result = await ctx.db
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
					workspaceId: transactions.workspaceId,
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
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (result.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			return result[0];
		}),

	updateExpenseCategory: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				expenseCategoryId: z.string().nullable(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify transaction belongs to user's workspace
			const transaction = await ctx.db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (transaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			return ctx.db
				.update(transactions)
				.set({
					expenseCategoryId: input.expenseCategoryId,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id));
		}),

	updateHandled: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				handled: z.boolean(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify transaction belongs to user's workspace
			const transaction = await ctx.db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (transaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			return ctx.db
				.update(transactions)
				.set({
					handled: input.handled,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id));
		}),

	// New endpoints for transaction splits
	createSplits: protectedProcedure
		.input(
			z.object({
				sourceTransactionId: z.string(),
				workspaceId: z.string(),
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
				.select({
					amountInPounds: transactions.amountInPounds,
					workspaceId: transactions.workspaceId,
				})
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.sourceTransactionId),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
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
					workspaceId: input.workspaceId,
					sourceTransactionId: input.sourceTransactionId,
					currentAccountId: split.currentAccountId,
					amountInPounds: split.amountInPounds,
					description: split.description,
				})),
			);
		}),

	getSplitsByTransactionId: protectedProcedure
		.input(
			z.object({
				transactionId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify transaction belongs to user's workspace
			const transaction = await ctx.db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (transaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

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
				.where(
					and(
						eq(transactionSplits.sourceTransactionId, input.transactionId),
						eq(transactionSplits.workspaceId, input.workspaceId),
					),
				);
		}),

	deleteSplit: protectedProcedure
		.input(
			z.object({
				splitId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify split belongs to user's workspace
			const split = await ctx.db
				.select()
				.from(transactionSplits)
				.where(
					and(
						eq(transactionSplits.id, input.splitId),
						eq(transactionSplits.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (split.length === 0) {
				throw new Error("Split not found or access denied");
			}

			return ctx.db
				.delete(transactionSplits)
				.where(eq(transactionSplits.id, input.splitId));
		}),

	deleteAllSplits: protectedProcedure
		.input(
			z.object({
				transactionId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify transaction belongs to user's workspace
			const transaction = await ctx.db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (transaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			return ctx.db
				.delete(transactionSplits)
				.where(
					and(
						eq(transactionSplits.sourceTransactionId, input.transactionId),
						eq(transactionSplits.workspaceId, input.workspaceId),
					),
				);
		}),

	// New endpoint to calculate owed balance for an account (including manual splits)
	getOwedBalanceByAccountId: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify account belongs to user's workspace
			const account = await ctx.db
				.select()
				.from(currentAccounts)
				.where(
					and(
						eq(currentAccounts.id, input.accountId),
						eq(currentAccounts.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (account.length === 0) {
				throw new Error("Account not found or access denied");
			}

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
						eq(transactions.workspaceId, input.workspaceId),
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
						eq(transactions.workspaceId, input.workspaceId),
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
						eq(transactionSplits.workspaceId, input.workspaceId),
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
						eq(transactionSplits.workspaceId, input.workspaceId),
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
	getSplitsByAccountId: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify account belongs to user's workspace
			const account = await ctx.db
				.select()
				.from(currentAccounts)
				.where(
					and(
						eq(currentAccounts.id, input.accountId),
						eq(currentAccounts.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (account.length === 0) {
				throw new Error("Account not found or access denied");
			}

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
				.where(eq(transactionSplits.workspaceId, input.workspaceId))
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
							.where(
								and(
									eq(currentAccounts.id, split.sourceAccountId),
									eq(currentAccounts.workspaceId, input.workspaceId),
								),
							)
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
	createManualSplit: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				sourceAccountId: z.string(),
				targetAccountId: z.string(),
				amount: z.number().positive(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const {
				workspaceId,
				sourceAccountId,
				targetAccountId,
				amount,
				description,
			} = input;

			// Validate that accounts exist and belong to the workspace
			const [sourceAccount, targetAccount] = await Promise.all([
				ctx.db
					.select()
					.from(currentAccounts)
					.where(
						and(
							eq(currentAccounts.id, sourceAccountId),
							eq(currentAccounts.workspaceId, workspaceId),
						),
					)
					.limit(1),
				ctx.db
					.select()
					.from(currentAccounts)
					.where(
						and(
							eq(currentAccounts.id, targetAccountId),
							eq(currentAccounts.workspaceId, workspaceId),
						),
					)
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
					workspaceId,
					sourceAccountId,
					currentAccountId: targetAccountId,
					amountInPounds: amount,
					description,
				})
				.returning();

			return result[0];
		}),

	// Delete transaction
	delete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify transaction belongs to user's workspace
			const transaction = await ctx.db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (transaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			// Delete all splits for this transaction first
			await ctx.db
				.delete(transactionSplits)
				.where(eq(transactionSplits.sourceTransactionId, input.id));

			// Delete the transaction
			return ctx.db.delete(transactions).where(eq(transactions.id, input.id));
		}),

	// Get debt matrix showing how much each account owes each other account
	getDebtMatrix: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get all accounts in the workspace
			const accounts = await ctx.db
				.select({
					id: currentAccounts.id,
					name: currentAccounts.name,
					accountType: currentAccounts.accountType,
				})
				.from(currentAccounts)
				.where(eq(currentAccounts.workspaceId, input.workspaceId))
				.orderBy(currentAccounts.name);

			// Get all transaction splits in the workspace
			const splits = await ctx.db
				.select({
					sourceTransactionId: transactionSplits.sourceTransactionId,
					sourceAccountId: transactionSplits.sourceAccountId,
					currentAccountId: transactionSplits.currentAccountId,
					amountInPounds: transactionSplits.amountInPounds,
					sourceTransactionAccountId: transactions.currentAccountId,
				})
				.from(transactionSplits)
				.leftJoin(
					transactions,
					eq(transactionSplits.sourceTransactionId, transactions.id),
				)
				.where(eq(transactionSplits.workspaceId, input.workspaceId));

			// Create a map to track net debts between accounts
			const debtMap = new Map<string, Map<string, number>>();

			// Initialize the debt map
			for (const account of accounts) {
				debtMap.set(account.id, new Map());
				for (const otherAccount of accounts) {
					if (account.id !== otherAccount.id) {
						const accountMap = debtMap.get(account.id);
						if (accountMap) {
							accountMap.set(otherAccount.id, 0);
						}
					}
				}
			}

			// Process splits to calculate debts
			for (const split of splits) {
				// Determine the source account ID
				const sourceAccountId = split.sourceAccountId ?? split.sourceTransactionAccountId;
				const targetAccountId = split.currentAccountId;

				if (sourceAccountId && targetAccountId && sourceAccountId !== targetAccountId) {
					// This represents money that the source account owes to the target account
					const sourceMap = debtMap.get(sourceAccountId);
					if (sourceMap) {
						const currentDebt = sourceMap.get(targetAccountId) ?? 0;
						sourceMap.set(targetAccountId, currentDebt + split.amountInPounds);
					}

					// Also update the reverse relationship (target account is owed by source account)
					// This means we subtract the same amount from what target owes to source
					const targetMap = debtMap.get(targetAccountId);
					if (targetMap) {
						const currentReverseDebt = targetMap.get(sourceAccountId) ?? 0;
						targetMap.set(sourceAccountId, currentReverseDebt - split.amountInPounds);
					}
				}
			}

			// Convert to the matrix format expected by the frontend
			const matrix = accounts.map((rowAccount) => ({
				account: rowAccount,
				debts: accounts
					.filter((colAccount) => colAccount.id !== rowAccount.id)
					.map((colAccount) => ({
						toAccount: colAccount,
						amount: debtMap.get(rowAccount.id)?.get(colAccount.id) ?? 0,
					})),
			}));

			return {
				accounts,
				matrix,
			};
		}),
});
