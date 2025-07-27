import type { Client } from "@libsql/client";
import { and, count, desc, eq, gte, lte, ne } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import { processFileWithSchema } from "grandeo/server/bedrock";
import { statements, transactions } from "grandeo/server/db/schema";
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
	getByAccountId: publicProcedure
		.input(z.object({ accountId: z.string() }))
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
				.where(eq(statements.currentAccountId, input.accountId))
				.groupBy(statements.id)
				.orderBy(desc(statements.periodEndDate));

			return statementsWithCount;
		}),

	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(statements)
				.where(eq(statements.id, input.id))
				.limit(1);
		}),

	create: publicProcedure
		.input(
			z.object({
				currentAccountId: z.string(),
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

			return handleParseStatement({
				id: result.id,
				db: ctx.db,
			});
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.string(),
				periodStartDate: z.date().nullable(),
				periodEndDate: z.date().nullable(),
				openingBalance: z.number().nullable(),
				closingBalance: z.number().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			return ctx.db
				.update(statements)
				.set(updateData)
				.where(eq(statements.id, id))
				.returning()
				.then((res) => res[0]);
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// First, fetch the statement to get the S3 path
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(eq(statements.id, input.id))
				.limit(1)
				.then((res) => res[0]);

			if (!statement) {
				throw new Error("Statement not found");
			}

			// Delete the file from S3
			await deleteFileFromS3(statement.sourcePathDataBucket);

			return ctx.db.delete(statements).where(eq(statements.id, input.id));
		}),

	download: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get the statement record
			const statement = await ctx.db
				.select()
				.from(statements)
				.where(eq(statements.id, input.id))
				.limit(1)
				.then((res) => res[0]);

			if (!statement) {
				throw new Error("Statement not found");
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

	parseStatement: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await handleParseStatement({
				id: input.id,
				db: ctx.db,
			});
		}),
});

const handleParseStatement = async ({
	id,
	db,
}: {
	id: string;
	db: LibSQLDatabase<
		typeof import("/home/harry/Documents/grandeo/src/server/db/schema")
	> & {
		$client: Client;
	};
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

	// Get statement file from S3
	const file = await getFileFromS3(statement.sourcePathDataBucket);

	const result = await processFileWithSchema({
		fileName: statement.sourceFileName,
		fileBuffer: file,
		schema: statementSchema,
		prompt: "Parse the provided account statement",
		mimeType:
			mime.lookup(statement.sourceFileName.split(".").pop() || "") ||
			"application/octet-stream",
	});

	if (result.isErr()) {
		throw new Error(`Error processing statement file: ${result.error.message}`);
	}

	const {
		periodStartDate,
		periodEndDate,
		openingBalance,
		closingBalance,
		transactions: parsedTransactions,
	} = result.value;

	// update the statement with parsed data
	await db
		.update(statements)
		.set({
			periodStartDate,
			periodEndDate,
			openingBalance,
			closingBalance,
		})
		.where(eq(statements.id, id));

	// Create transaction records from parsed data, checking for duplicates per transaction
	if (parsedTransactions && parsedTransactions.length > 0) {
		const validTransactions = parsedTransactions.filter(
			(transaction): transaction is typeof transaction & { date: Date } =>
				transaction.date !== null,
		);

		const newTransactionRecords = [];
		let duplicateCount = 0;

		for (const transaction of validTransactions) {
			// Check if there are any existing statements (other than this one) that cover this transaction date
			const existingStatements = await db
				.select()
				.from(statements)
				.where(
					and(
						eq(statements.currentAccountId, statement.currentAccountId),
						ne(statements.id, id), // Exclude the current statement
						lte(statements.periodStartDate, transaction.date),
						gte(statements.periodEndDate, transaction.date),
					),
				)
				.limit(1);

			// Only add the transaction if no existing statement covers this date
			if (existingStatements.length === 0) {
				newTransactionRecords.push({
					currentAccountId: statement.currentAccountId,
					sourceStatementId: id,
					amountInPounds: transaction.amount,
					description: transaction.description,
					date: transaction.date,
				});
			} else {
				duplicateCount++;
			}
		}

		// Insert only the non-duplicate transactions
		if (newTransactionRecords.length > 0) {
			await db.insert(transactions).values(newTransactionRecords);
		}

		// Log summary of what was processed
		console.log(
			`Statement ${id} processing complete: ${newTransactionRecords.length} new transactions added, ${duplicateCount} transactions skipped (covered by existing statements)`,
		);
	}
};
