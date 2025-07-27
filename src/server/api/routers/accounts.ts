import { z } from "zod";

import { and, asc, desc, eq, isNotNull, lte, gte } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import {
	currentAccounts,
	statements,
	transactions,
	accountBalances,
} from "grandeo/server/db/schema";

export const accountsRouter = createTRPCRouter({
	getAll: publicProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(currentAccounts)
				.where(eq(currentAccounts.workspaceId, input.workspaceId));
		}),

	getById: publicProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
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
				.limit(1)
				.then((res) => res[0]);
		}),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required").trim(),
				accountType: z
					.enum(["current_account", "credit_card"])
					.default("current_account"),
				workspaceId: z.string(),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(currentAccounts).values({
				name: input.name,
				accountType: input.accountType,
				workspaceId: input.workspaceId,
			});
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required"),
				accountType: z.enum(["current_account", "credit_card"]).optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
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

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(currentAccounts)
				.where(eq(currentAccounts.id, input.id));
		}),

	recomputeBalances: publicProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			try {
				// Delete existing computed balances for this account
				await ctx.db
					.delete(accountBalances)
					.where(
						and(
							eq(accountBalances.currentAccountId, input.id),
							eq(accountBalances.workspaceId, input.workspaceId),
						),
					);

				// Get all transactions for this account
				const accountTransactions = await ctx.db
					.select({
						amountInPounds: transactions.amountInPounds,
						date: transactions.date,
					})
					.from(transactions)
					.where(
						and(
							eq(transactions.currentAccountId, input.id),
							eq(transactions.workspaceId, input.workspaceId),
						),
					)
					.orderBy(asc(transactions.date));

				// Get statement balances for reference points
				const statementBalances = await ctx.db
					.select({
						openingBalance: statements.openingBalance,
						closingBalance: statements.closingBalance,
						periodStartDate: statements.periodStartDate,
						periodEndDate: statements.periodEndDate,
					})
					.from(statements)
					.where(
						and(
							eq(statements.currentAccountId, input.id),
							eq(statements.workspaceId, input.workspaceId),
							isNotNull(statements.openingBalance),
							isNotNull(statements.closingBalance),
							isNotNull(statements.periodStartDate),
							isNotNull(statements.periodEndDate),
						),
					)
					.orderBy(asc(statements.periodStartDate));

				if (accountTransactions.length === 0) {
					// No transactions, create zero balances for the last year
					const endDate = new Date();
					const startDate = new Date();
					startDate.setFullYear(endDate.getFullYear() - 1);

					const balancesToInsert = [];
					for (
						let d = new Date(startDate);
						d <= endDate;
						d.setDate(d.getDate() + 1)
					) {
						balancesToInsert.push({
							workspaceId: input.workspaceId,
							currentAccountId: input.id,
							date: new Date(d),
							balance: 0,
						});
					}

					if (balancesToInsert.length > 0) {
						await ctx.db.insert(accountBalances).values(balancesToInsert);
					}
					return { success: true, message: "Balances recomputed successfully" };
				}

				// Find the earliest transaction date and earliest statement date
				const earliestTransaction = accountTransactions[0];
				if (!earliestTransaction) {
					throw new Error("No transactions found");
				}

				// Find the earliest statement date
				const earliestStatement = statementBalances[0]; // Already ordered by periodStartDate ASC

				// Calculate start date (earliest transaction, or earliest statement - whichever makes sense)
				const endDate = new Date();

				let startDate: Date;
				let hasValidBalance = false;
				let currentBalance = 0;

				// If we have statement data, use the earliest statement start as our reference point
				if (
					earliestStatement?.periodStartDate &&
					earliestStatement.openingBalance !== null
				) {
					// Use the earliest statement as our starting point
					const earliestStatementStart = new Date(
						earliestStatement.periodStartDate,
					);
					startDate = earliestStatementStart;
					// Start from the opening balance of the earliest statement
					if (startDate <= earliestStatementStart) {
						currentBalance = earliestStatement.openingBalance;
						hasValidBalance = true;

						// Add any transactions from the statement start up to our computed start date
						const transactionsFromStatementStart = accountTransactions.filter(
							(t) => {
								const transactionDate = new Date(t.date);
								return (
									transactionDate >= earliestStatementStart &&
									transactionDate < startDate
								);
							},
						);
						currentBalance += transactionsFromStatementStart.reduce(
							(sum, t) => sum + t.amountInPounds,
							0,
						);
					} else {
						// Our start date is after the earliest statement, find the appropriate reference
						const statementContainingStart = statementBalances.find(
							(stmt) =>
								stmt.periodStartDate &&
								stmt.periodEndDate &&
								new Date(stmt.periodStartDate) <= startDate &&
								new Date(stmt.periodEndDate) >= startDate,
						);

						const statementBeforeStart = statementBalances
							.filter(
								(stmt) =>
									stmt.periodEndDate &&
									new Date(stmt.periodEndDate) < startDate &&
									stmt.closingBalance !== null,
							)
							.sort((a, b) => {
								if (!a.periodEndDate || !b.periodEndDate) return 0;
								return (
									new Date(b.periodEndDate).getTime() -
									new Date(a.periodEndDate).getTime()
								);
							})[0];

						if (
							statementContainingStart &&
							statementContainingStart.openingBalance !== null
						) {
							// Start date falls within a statement period
							currentBalance = statementContainingStart.openingBalance;
							hasValidBalance = true;
							const transactionsInPeriodBeforeStart =
								accountTransactions.filter(
									(t) =>
										statementContainingStart.periodStartDate &&
										new Date(t.date) >=
											new Date(statementContainingStart.periodStartDate) &&
										new Date(t.date) < startDate,
								);
							currentBalance += transactionsInPeriodBeforeStart.reduce(
								(sum, t) => sum + t.amountInPounds,
								0,
							);
						} else if (
							statementBeforeStart &&
							statementBeforeStart.closingBalance !== null
						) {
							// Use the most recent statement closing balance before our period
							currentBalance = statementBeforeStart.closingBalance;
							hasValidBalance = true;
							const transactionsAfterStatement = accountTransactions.filter(
								(t) =>
									statementBeforeStart.periodEndDate &&
									new Date(t.date) >
										new Date(statementBeforeStart.periodEndDate) &&
									new Date(t.date) < startDate,
							);
							currentBalance += transactionsAfterStatement.reduce(
								(sum, t) => sum + t.amountInPounds,
								0,
							);
						}
					}
				} else {
					// No valid statement data, start from earliest transaction or 1 year ago
					startDate = new Date(
						Math.max(new Date(earliestTransaction.date).getTime()),
					);
					currentBalance = 0;
					hasValidBalance = false; // Will show 0 until we find a statement
				}

				// Generate daily balance data
				const balancesToInsert = [];
				for (
					let d = new Date(startDate);
					d <= endDate;
					d.setDate(d.getDate() + 1)
				) {
					const dayString = d.toISOString().split("T")[0];
					if (!dayString) continue;

					// Check if we need to initialize balance from first statement
					if (!hasValidBalance) {
						const containingStatement = statementBalances.find(
							(stmt) =>
								stmt.periodStartDate &&
								stmt.periodEndDate &&
								new Date(stmt.periodStartDate) <= d &&
								new Date(stmt.periodEndDate) >= d,
						);

						if (
							containingStatement &&
							containingStatement.openingBalance !== null
						) {
							currentBalance = containingStatement.openingBalance;
							// Add transactions from statement start to current day
							const transactionsInPeriod = accountTransactions.filter(
								(t) =>
									containingStatement.periodStartDate &&
									new Date(t.date) >=
										new Date(containingStatement.periodStartDate) &&
									new Date(t.date) < d,
							);
							currentBalance += transactionsInPeriod.reduce(
								(sum, t) => sum + t.amountInPounds,
								0,
							);
							hasValidBalance = true;
						}
					}

					// Add transactions from this day
					const dayTransactions = accountTransactions.filter((t) => {
						const transactionDate = new Date(t.date)
							.toISOString()
							.split("T")[0];
						return transactionDate === dayString;
					});

					for (const t of dayTransactions) {
						currentBalance += t.amountInPounds;
					}

					balancesToInsert.push({
						workspaceId: input.workspaceId,
						currentAccountId: input.id,
						date: new Date(d),
						balance: hasValidBalance
							? Math.round(currentBalance * 100) / 100
							: 0,
					});
				}

				// Insert computed balances in batches
				const batchSize = 100;
				for (let i = 0; i < balancesToInsert.length; i += batchSize) {
					const batch = balancesToInsert.slice(i, i + batchSize);
					await ctx.db.insert(accountBalances).values(batch);
				}

				return { success: true, message: "Balances recomputed successfully" };
			} catch (error) {
				console.error("Error in recomputeBalances:", error);
				throw new Error("Failed to recompute balances");
			}
		}),

	getBalanceHistory: publicProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				days: z.number().min(1).max(365).default(30),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				// Calculate date range
				const endDate = new Date();
				const startDate = new Date();
				startDate.setDate(endDate.getDate() - input.days);

				// Get computed balances from the table
				const balances = await ctx.db
					.select({
						date: accountBalances.date,
						balance: accountBalances.balance,
					})
					.from(accountBalances)
					.where(
						and(
							eq(accountBalances.currentAccountId, input.id),
							eq(accountBalances.workspaceId, input.workspaceId),
							lte(accountBalances.date, endDate),
							gte(accountBalances.date, startDate),
						),
					)
					.orderBy(asc(accountBalances.date));

				// Convert to the expected format
				const balanceHistory = balances.map((balance) => ({
					date: balance.date.toISOString().split("T")[0] || "",
					balance: balance.balance,
				}));

				// If no computed balances exist, return empty array (user needs to recompute)
				if (balanceHistory.length === 0) {
					return [];
				}

				return balanceHistory;
			} catch (error) {
				console.error("Error in getBalanceHistory:", error);
				throw new Error("Failed to get balance history");
			}
		}),
});
