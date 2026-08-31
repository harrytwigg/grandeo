import { and, asc, count, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import type { db as database } from "grandeo/server/db";
import {
	expenseCategories,
	stagedTransactions,
	statementImportBatches,
	statements,
	transactions,
} from "grandeo/server/db/schema";
import { z } from "zod";

export const statementImportsRouter = createTRPCRouter({
	getPendingByAccountId: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select({
					id: statementImportBatches.id,
					statementId: statementImportBatches.statementId,
					createdAt: statementImportBatches.createdAt,
					transactionCount: count(stagedTransactions.id),
				})
				.from(statementImportBatches)
				.leftJoin(
					stagedTransactions,
					eq(stagedTransactions.batchId, statementImportBatches.id),
				)
				.where(
					and(
						eq(statementImportBatches.currentAccountId, input.accountId),
						eq(statementImportBatches.workspaceId, input.workspaceId),
						eq(statementImportBatches.status, "pending"),
					),
				)
				.groupBy(statementImportBatches.id);
		}),

	getPendingByStatementId: protectedProcedure
		.input(
			z.object({
				statementId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const batch = await ctx.db
				.select({
					id: statementImportBatches.id,
					statementId: statementImportBatches.statementId,
					currentAccountId: statementImportBatches.currentAccountId,
					status: statementImportBatches.status,
					periodStartDate: statementImportBatches.periodStartDate,
					periodEndDate: statementImportBatches.periodEndDate,
					openingBalance: statementImportBatches.openingBalance,
					closingBalance: statementImportBatches.closingBalance,
					createdAt: statementImportBatches.createdAt,
					sourceFileName: statements.sourceFileName,
				})
				.from(statementImportBatches)
				.innerJoin(
					statements,
					eq(statementImportBatches.statementId, statements.id),
				)
				.where(
					and(
						eq(statementImportBatches.statementId, input.statementId),
						eq(statementImportBatches.workspaceId, input.workspaceId),
						eq(statementImportBatches.status, "pending"),
					),
				)
				.limit(1)
				.then((res) => res[0]);

			if (!batch) {
				return null;
			}

			const stagedTransactionsList = await ctx.db
				.select({
					id: stagedTransactions.id,
					batchId: stagedTransactions.batchId,
					expenseCategoryId: stagedTransactions.expenseCategoryId,
					amountInPounds: stagedTransactions.amountInPounds,
					description: stagedTransactions.description,
					date: stagedTransactions.date,
					included: stagedTransactions.included,
					duplicateOfTransactionId: stagedTransactions.duplicateOfTransactionId,
					createdAt: stagedTransactions.createdAt,
					expenseCategory: {
						id: expenseCategories.id,
						name: expenseCategories.name,
					},
				})
				.from(stagedTransactions)
				.leftJoin(
					expenseCategories,
					eq(stagedTransactions.expenseCategoryId, expenseCategories.id),
				)
				.where(eq(stagedTransactions.batchId, batch.id))
				.orderBy(
					asc(stagedTransactions.date),
					asc(stagedTransactions.createdAt),
				);

			return { batch, stagedTransactions: stagedTransactionsList };
		}),

	updateBatch: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				periodStartDate: z.date().nullable(),
				periodEndDate: z.date().nullable(),
				openingBalance: z.number().nullable(),
				closingBalance: z.number().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, workspaceId, ...updateData } = input;

			await requirePendingBatch({ db: ctx.db, id, workspaceId });

			return ctx.db
				.update(statementImportBatches)
				.set({ ...updateData, updatedAt: new Date() })
				.where(eq(statementImportBatches.id, id))
				.returning()
				.then((res) => res[0]);
		}),

	addStagedTransaction: protectedProcedure
		.input(
			z.object({
				batchId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const batch = await requirePendingBatch({
				db: ctx.db,
				id: input.batchId,
				workspaceId: input.workspaceId,
			});

			return ctx.db
				.insert(stagedTransactions)
				.values({
					workspaceId: input.workspaceId,
					batchId: batch.id,
					amountInPounds: 0,
					description: "",
					date: batch.periodEndDate ?? new Date(),
					included: true,
				})
				.returning()
				.then((res) => res[0]);
		}),

	updateStagedTransaction: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				date: z.date().nullable(),
				description: z.string().nullable(),
				amountInPounds: z.number(),
				expenseCategoryId: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, workspaceId, ...updateData } = input;

			await requirePendingStagedTransaction({ db: ctx.db, id, workspaceId });

			return ctx.db
				.update(stagedTransactions)
				.set({ ...updateData, updatedAt: new Date() })
				.where(eq(stagedTransactions.id, id))
				.returning()
				.then((res) => res[0]);
		}),

	setStagedTransactionIncluded: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				included: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requirePendingStagedTransaction({
				db: ctx.db,
				id: input.id,
				workspaceId: input.workspaceId,
			});

			return ctx.db
				.update(stagedTransactions)
				.set({ included: input.included, updatedAt: new Date() })
				.where(eq(stagedTransactions.id, input.id));
		}),

	deleteStagedTransaction: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requirePendingStagedTransaction({
				db: ctx.db,
				id: input.id,
				workspaceId: input.workspaceId,
			});

			return ctx.db
				.delete(stagedTransactions)
				.where(eq(stagedTransactions.id, input.id));
		}),

	approveBatch: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const batch = await requirePendingBatch({
				db: ctx.db,
				id: input.id,
				workspaceId: input.workspaceId,
			});

			const staged = await ctx.db
				.select()
				.from(stagedTransactions)
				.where(
					and(
						eq(stagedTransactions.batchId, batch.id),
						eq(stagedTransactions.included, true),
					),
				);

			const undatedCount = staged.filter((row) => row.date === null).length;

			if (undatedCount > 0) {
				throw new Error(
					`${undatedCount} transaction${undatedCount === 1 ? " has" : "s have"} no date. Set a date or untick the row before approving.`,
				);
			}

			const transactionRecords = staged
				.filter((row): row is typeof row & { date: Date } => row.date !== null)
				.map((row) => ({
					workspaceId: batch.workspaceId,
					currentAccountId: batch.currentAccountId,
					sourceStatementId: batch.statementId,
					expenseCategoryId: row.expenseCategoryId,
					amountInPounds: row.amountInPounds,
					description: row.description,
					date: row.date,
				}));

			await ctx.db.transaction(async (tx) => {
				// The reviewed statement values are only applied on approval
				await tx
					.update(statements)
					.set({
						periodStartDate: batch.periodStartDate,
						periodEndDate: batch.periodEndDate,
						openingBalance: batch.openingBalance,
						closingBalance: batch.closingBalance,
						updatedAt: new Date(),
					})
					.where(eq(statements.id, batch.statementId));

				if (transactionRecords.length > 0) {
					await tx.insert(transactions).values(transactionRecords);
				}

				await tx
					.update(statementImportBatches)
					.set({
						status: "approved",
						reviewedAt: new Date(),
						reviewedBy: ctx.auth.userId,
						updatedAt: new Date(),
					})
					.where(eq(statementImportBatches.id, batch.id));
			});

			console.log(
				`Statement import batch ${batch.id} approved: ${transactionRecords.length} transactions imported`,
			);

			return {
				statementId: batch.statementId,
				importedCount: transactionRecords.length,
			};
		}),

	discardBatch: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const batch = await requirePendingBatch({
				db: ctx.db,
				id: input.id,
				workspaceId: input.workspaceId,
			});

			await ctx.db
				.update(statementImportBatches)
				.set({
					status: "discarded",
					reviewedAt: new Date(),
					reviewedBy: ctx.auth.userId,
					updatedAt: new Date(),
				})
				.where(eq(statementImportBatches.id, batch.id));

			return { statementId: batch.statementId };
		}),
});

const requirePendingBatch = async ({
	db,
	id,
	workspaceId,
}: {
	db: typeof database;
	id: string;
	workspaceId: string;
}) => {
	const batch = await db
		.select()
		.from(statementImportBatches)
		.where(
			and(
				eq(statementImportBatches.id, id),
				eq(statementImportBatches.workspaceId, workspaceId),
			),
		)
		.limit(1)
		.then((res) => res[0]);

	if (!batch) {
		throw new Error("Import batch not found or access denied");
	}

	if (batch.status !== "pending") {
		throw new Error(`This import has already been ${batch.status}`);
	}

	return batch;
};

const requirePendingStagedTransaction = async ({
	db,
	id,
	workspaceId,
}: {
	db: typeof database;
	id: string;
	workspaceId: string;
}) => {
	const staged = await db
		.select({
			id: stagedTransactions.id,
			batchId: stagedTransactions.batchId,
			status: statementImportBatches.status,
		})
		.from(stagedTransactions)
		.innerJoin(
			statementImportBatches,
			eq(stagedTransactions.batchId, statementImportBatches.id),
		)
		.where(
			and(
				eq(stagedTransactions.id, id),
				eq(stagedTransactions.workspaceId, workspaceId),
			),
		)
		.limit(1)
		.then((res) => res[0]);

	if (!staged) {
		throw new Error("Staged transaction not found or access denied");
	}

	if (staged.status !== "pending") {
		throw new Error(`This import has already been ${staged.status}`);
	}

	return staged;
};
