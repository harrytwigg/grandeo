import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import { BedrockError, processFileWithSchema } from "grandeo/server/bedrock";
import type { db as database } from "grandeo/server/db";
import {
	currentAccounts,
	stagedTransactions,
	statementImportBatches,
	statements,
	transactions,
} from "grandeo/server/db/schema";
import {
	deleteFileFromS3,
	getFileFromS3,
	uploadFileToS3,
} from "grandeo/server/s3";
import mime from "mime-types";
import { z } from "zod";

// What we want to extract from the file
const statementSchema = z.object({
	openingBalance: z
		.number({
			description:
				"The opening balance of the statement, do not guess, use null if not available",
		})
		.nullable(),
	closingBalance: z
		.number({
			description:
				"The closing balance of the statement, do not guess, use null if not available",
		})
		.nullable(),
	periodStartDate: z
		.string({
			description:
				"The start date of the statement period in DD/MM/YYYY, do not guess, use null if not available",
		})
		.nullable()
		.transform((date) => {
			if (!date) return null;

			const [day, month, year] = date.split("/").map(Number);

			if (
				typeof day !== "number" ||
				typeof month !== "number" ||
				typeof year !== "number"
			) {
				throw new Error("Invalid date format");
			}

			return new Date(year, month - 1, day);
		}),
	periodEndDate: z
		.string({
			description:
				"The end date of the statement period in DD/MM/YYYY, do not guess, use null if not available",
		})
		.nullable()
		.transform((date) => {
			if (!date) return null;

			const [day, month, year] = date.split("/").map(Number);

			if (
				typeof day !== "number" ||
				typeof month !== "number" ||
				typeof year !== "number"
			) {
				throw new Error("Invalid date format");
			}

			return new Date(year, month - 1, day);
		}),
	transactions: z.array(
		z.object({
			date: z
				.string({
					description:
						"The date of the transaction in DD/MM/YYY format, do not guess, use null if not available",
				})
				.nullable()
				.transform((date) => {
					if (!date) return null;

					const [day, month, year] = date.split("/").map(Number);

					if (
						typeof day !== "number" ||
						typeof month !== "number" ||
						typeof year !== "number"
					) {
						throw new Error("Invalid date format");
					}

					return new Date(year, month - 1, day);
				}),

			description: z.string({
				description:
					"Description is required, this is likely what the transaction is for eg Easyjet, phone bill etc",
			}),
			amount: z
				.number({
					description:
						"The transaction amount, positive for deposits, negative for withdrawals/outgoings",
				})
				.default(0),
		}),
	),
});

export const statementsRouter = createTRPCRouter({
	getByAccountId: protectedProcedure
		.input(
			z.object({
				accountId: z.string(),
				workspaceId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get statements with transaction count
			const statementsWithCount = await ctx.db
				.select({
					id: statements.id,
					currentAccountId: statements.currentAccountId,
					periodStartDate: statements.periodStartDate,
					periodEndDate: statements.periodEndDate,
					openingBalance: statements.openingBalance,
					closingBalance: statements.closingBalance,
					sourceFileName: statements.sourceFileName,
					sourcePathDataBucket: statements.sourcePathDataBucket,
					createdAt: statements.createdAt,
					updatedAt: statements.updatedAt,
					transactionCount: count(transactions.id),
				})
				.from(statements)
				.leftJoin(
					transactions,
					eq(transactions.sourceStatementId, statements.id),
				)
				.where(
					and(
						eq(statements.currentAccountId, input.accountId),
						eq(statements.workspaceId, input.workspaceId),
					),
				)
				.groupBy(statements.id)
				.orderBy(desc(statements.periodEndDate));

			return statementsWithCount;
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
				.select()
				.from(statements)
				.where(
					and(
						eq(statements.id, input.id),
						eq(statements.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (result.length === 0) {
				throw new Error("Statement not found or access denied");
			}

			return result[0];
		}),

	create: protectedProcedure
		.input(
			z.object({
				currentAccountId: z.string(),
				workspaceId: z.string(),
				fileBase64: z.string(),
				fileName: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Convert base64 to buffer
			const fileBuffer = Buffer.from(input.fileBase64, "base64");

			// Generate unique file path
			const timestamp = Date.now();
			const fileExtension = input.fileName.split(".").pop() || "";
			const uniqueFileName = `statement_${input.currentAccountId}_${timestamp}.${fileExtension}`;
			const s3Path = `statements/${input.currentAccountId}/${uniqueFileName}`;

			// Upload to S3
			await uploadFileToS3(s3Path, fileBuffer, `application/${fileExtension}`);

			// Create statement record with null values for parsing fields
			// These will be populated later when we implement file parsing
			const result = await ctx.db
				.insert(statements)
				.values({
					workspaceId: input.workspaceId,
					currentAccountId: input.currentAccountId,
					periodStartDate: null,
					periodEndDate: null,
					openingBalance: null,
					closingBalance: null,
					sourceFileName: input.fileName,
					sourcePathDataBucket: s3Path,
				})
				.returning()
				.then((res) => res[0]);

			if (!result) {
				throw new Error("Failed to create statement record");
			}

			const batch = await handleParseStatement({
				id: result.id,
				db: ctx.db,
			});

			return { statementId: result.id, batchId: batch.id };
		}),

	update: protectedProcedure
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

			// Verify statement belongs to user's workspace
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(
					and(eq(statements.id, id), eq(statements.workspaceId, workspaceId)),
				)
				.limit(1);

			if (statement.length === 0) {
				throw new Error("Statement not found or access denied");
			}

			return ctx.db
				.update(statements)
				.set(updateData)
				.where(eq(statements.id, id))
				.returning()
				.then((res) => res[0]);
		}),

	delete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// First, fetch the statement to get the S3 path and verify workspace access
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(
					and(
						eq(statements.id, input.id),
						eq(statements.workspaceId, input.workspaceId),
					),
				)
				.limit(1)
				.then((res) => res[0]);

			if (!statement) {
				throw new Error("Statement not found or access denied");
			}

			// Delete the file from S3
			await deleteFileFromS3(statement.sourcePathDataBucket);

			// Remove any import batches for this statement explicitly, so a database
			// without foreign key enforcement cannot leave an orphaned pending batch
			await ctx.db
				.delete(statementImportBatches)
				.where(eq(statementImportBatches.statementId, input.id));

			return ctx.db.delete(statements).where(eq(statements.id, input.id));
		}),

	download: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Get the statement record and verify workspace access
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(
					and(
						eq(statements.id, input.id),
						eq(statements.workspaceId, input.workspaceId),
					),
				)
				.limit(1)
				.then((res) => res[0]);

			if (!statement) {
				throw new Error("Statement not found or access denied");
			}

			// Get file from S3
			const fileBuffer = await getFileFromS3(statement.sourcePathDataBucket);

			// Return file as base64 for download
			return {
				fileName: statement.sourceFileName,
				fileData: fileBuffer.toString("base64"),
				contentType: statement.sourceFileName.endsWith(".pdf")
					? "application/pdf"
					: "application/octet-stream",
			};
		}),

	parseStatement: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify statement belongs to user's workspace
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(
					and(
						eq(statements.id, input.id),
						eq(statements.workspaceId, input.workspaceId),
					),
				)
				.limit(1);

			if (statement.length === 0) {
				throw new Error("Statement not found or access denied");
			}

			const batch = await handleParseStatement({
				id: input.id,
				db: ctx.db,
			});

			return { batchId: batch.id };
		}),
});

/**
 * Surface a parse failure as something the uploader can act on.
 *
 * Parsing runs synchronously inside the upload mutation, so a Bedrock problem
 * otherwise appears as the upload itself failing with an opaque 500. A
 * BedrockError already carries an actionable message and a reason - map the
 * reason onto a tRPC code and pass the message straight through rather than
 * wrapping it again.
 */
const toParseError = (error: Error): TRPCError => {
	if (!(error instanceof BedrockError)) {
		return new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Could not parse this statement: ${error.message}`,
			cause: error,
		});
	}

	switch (error.kind) {
		case "access-denied":
			return new TRPCError({
				code: "PRECONDITION_FAILED",
				message: `Statement parsing is not configured correctly. ${error.message}`,
				cause: error,
			});
		case "invalid-request":
			return new TRPCError({
				code: "PRECONDITION_FAILED",
				message: `Statement parsing is misconfigured. ${error.message}`,
				cause: error,
			});
		case "rate-limited":
		case "unavailable":
			return new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: `${error.message} The statement has been uploaded - re-run parsing shortly.`,
				cause: error,
			});
		case "response-truncated":
		case "refused":
			return new TRPCError({
				code: "UNPROCESSABLE_CONTENT",
				message: error.message,
				cause: error,
			});
		default:
			return new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				cause: error,
			});
	}
};

/**
 * Parse a statement into a pending import batch for human review.
 *
 * Nothing is written to the live `transactions` table here: the extracted rows are
 * staged, and only `statementImports.approveBatch` commits them.
 */
const handleParseStatement = async ({
	id,
	db,
}: {
	id: string;
	db: typeof database;
}) => {
	// Fetch the statement to get the S3 path
	const statement = await db
		.select()
		.from(statements)
		.where(eq(statements.id, id))
		.limit(1)
		.then((res) => res[0]);

	if (!statement) {
		throw new Error("Statement not found");
	}

	// Pick up any account-specific parsing instructions set from the UI, e.g.
	// "this credit card statement shows spending as a positive number".
	const account = await db
		.select({ statementParsingPrompt: currentAccounts.statementParsingPrompt })
		.from(currentAccounts)
		.where(eq(currentAccounts.id, statement.currentAccountId))
		.limit(1)
		.then((res) => res[0]);

	// Get statement file from S3
	const file = await getFileFromS3(statement.sourcePathDataBucket);

	const result = await processFileWithSchema({
		fileName: statement.sourceFileName,
		fileBuffer: file,
		schema: statementSchema,
		prompt: buildStatementPrompt(account?.statementParsingPrompt),
		mimeType:
			mime.lookup(statement.sourceFileName.split(".").pop() || "") ||
			"application/octet-stream",
	});

	if (result.isErr()) {
		throw toParseError(result.error);
	}

	const {
		periodStartDate,
		periodEndDate,
		openingBalance,
		closingBalance,
		transactions: parsedTransactions,
	} = result.value;

	// A statement has at most one batch awaiting review - re-parsing replaces it
	await db
		.update(statementImportBatches)
		.set({ status: "discarded", updatedAt: new Date() })
		.where(
			and(
				eq(statementImportBatches.statementId, id),
				eq(statementImportBatches.status, "pending"),
			),
		);

	// The parsed statement values are proposals too, applied on approval
	const batch = await db
		.insert(statementImportBatches)
		.values({
			workspaceId: statement.workspaceId,
			statementId: id,
			currentAccountId: statement.currentAccountId,
			status: "pending",
			periodStartDate,
			periodEndDate,
			openingBalance,
			closingBalance,
		})
		.returning()
		.then((res) => res[0]);

	if (!batch) {
		throw new Error("Failed to create statement import batch");
	}

	if (parsedTransactions && parsedTransactions.length > 0) {
		// Every already imported transaction on this account, used to flag rows that
		// look like something we have imported before (a re-parse, or an overlapping
		// statement). Flagged rows are staged unticked rather than silently dropped,
		// so the reviewer can override the decision.
		const existingTransactions = await db
			.select({
				id: transactions.id,
				date: transactions.date,
				amountInPounds: transactions.amountInPounds,
			})
			.from(transactions)
			.where(eq(transactions.currentAccountId, statement.currentAccountId));

		const existingByDateAndAmount = new Map<string, string>();
		for (const existing of existingTransactions) {
			const key = `${existing.date.getTime()}:${existing.amountInPounds}`;
			if (!existingByDateAndAmount.has(key)) {
				existingByDateAndAmount.set(key, existing.id);
			}
		}

		const stagedRecords = parsedTransactions.map((transaction) => {
			const duplicateOfTransactionId = transaction.date
				? (existingByDateAndAmount.get(
						`${transaction.date.getTime()}:${transaction.amount}`,
					) ?? null)
				: null;

			return {
				workspaceId: statement.workspaceId,
				batchId: batch.id,
				amountInPounds: transaction.amount,
				description: transaction.description,
				date: transaction.date,
				included: duplicateOfTransactionId === null,
				duplicateOfTransactionId,
			};
		});

		await db.insert(stagedTransactions).values(stagedRecords);

		const duplicateCount = stagedRecords.filter(
			(record) => record.duplicateOfTransactionId !== null,
		).length;

		console.log(
			`Statement ${id} staged for review: ${stagedRecords.length} transactions parsed, ${duplicateCount} flagged as possible duplicates`,
		);
	}

	return batch;
};

const BASE_STATEMENT_PROMPT = "Parse the provided account statement";

/**
 * Combine the base parsing prompt with the account's own instructions, if any.
 * Account instructions come last so they take precedence over the defaults for
 * statements that don't follow the usual conventions.
 */
const buildStatementPrompt = (accountPrompt?: string | null) => {
	const trimmed = accountPrompt?.trim();

	if (!trimmed) {
		return BASE_STATEMENT_PROMPT;
	}

	return `${BASE_STATEMENT_PROMPT}

Additional instructions for this specific account. These override the general guidance above where they conflict:
${trimmed}`;
};
