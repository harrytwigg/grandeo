import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import {
	recurringExpenses,
	expenseCategories,
	currentAccounts,
} from "grandeo/server/db/schema";
import { eq } from "drizzle-orm";

export const recurringExpensesRouter = createTRPCRouter({
	getAll: publicProcedure.query(({ ctx }) => {
		return ctx.db
			.select({
				id: recurringExpenses.id,
				name: recurringExpenses.name,
				amountInPounds: recurringExpenses.amountInPounds,
				startDate: recurringExpenses.startDate,
				endDate: recurringExpenses.endDate,
				frequency: recurringExpenses.frequency,
				createdAt: recurringExpenses.createdAt,
				updatedAt: recurringExpenses.updatedAt,
				expenseCategory: {
					id: expenseCategories.id,
					name: expenseCategories.name,
				},
				currentAccount: {
					id: currentAccounts.id,
					name: currentAccounts.name,
				},
			})
			.from(recurringExpenses)
			.leftJoin(
				expenseCategories,
				eq(recurringExpenses.expenseCategoryId, expenseCategories.id),
			)
			.leftJoin(
				currentAccounts,
				eq(recurringExpenses.currentAccountId, currentAccounts.id),
			);
	}),

	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(recurringExpenses)
				.where(eq(recurringExpenses.id, input.id))
				.limit(1);
		}),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required"),
				amountInPounds: z.number().min(0.01, "Amount must be greater than 0"),
				expenseCategoryId: z.string().min(1, "Expense category is required"),
				currentAccountId: z.string().min(1, "Current account is required"),
				startDate: z.date(),
				endDate: z.date().optional(),
				frequency: z.enum(["daily", "weekly", "monthly", "annually"]),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(recurringExpenses).values({
				name: input.name,
				amountInPounds: input.amountInPounds,
				expenseCategoryId: input.expenseCategoryId,
				currentAccountId: input.currentAccountId,
				startDate: input.startDate,
				endDate: input.endDate,
				frequency: input.frequency,
			});
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required"),
				amountInPounds: z.number().min(0.01, "Amount must be greater than 0"),
				expenseCategoryId: z.string().min(1, "Expense category is required"),
				currentAccountId: z.string().min(1, "Current account is required"),
				startDate: z.date(),
				endDate: z.date().optional(),
				frequency: z.enum(["daily", "weekly", "monthly", "annually"]),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db
				.update(recurringExpenses)
				.set({
					name: input.name,
					amountInPounds: input.amountInPounds,
					expenseCategoryId: input.expenseCategoryId,
					currentAccountId: input.currentAccountId,
					startDate: input.startDate,
					endDate: input.endDate,
					frequency: input.frequency,
					updatedAt: new Date(),
				})
				.where(eq(recurringExpenses.id, input.id));
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(recurringExpenses)
				.where(eq(recurringExpenses.id, input.id));
		}),
});
