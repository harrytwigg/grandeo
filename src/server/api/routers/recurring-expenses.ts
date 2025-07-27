import { z } from "zod";

import { and, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import {
	currentAccounts,
	expenseCategories,
	recurringExpenses,
} from "grandeo/server/db/schema";

export const recurringExpensesRouter = createTRPCRouter({
	getAll: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(({ ctx, input }) => {
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
				)
				.where(eq(recurringExpenses.workspaceId, input.workspaceId));
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(recurringExpenses)
				.where(
					and(
						eq(recurringExpenses.id, input.id),
						eq(recurringExpenses.workspaceId, input.workspaceId),
					),
				)
				.limit(1);
		}),

	create: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
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
				workspaceId: input.workspaceId,
				name: input.name,
				amountInPounds: input.amountInPounds,
				expenseCategoryId: input.expenseCategoryId,
				currentAccountId: input.currentAccountId,
				startDate: input.startDate,
				endDate: input.endDate,
				frequency: input.frequency,
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
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
				.where(
					and(
						eq(recurringExpenses.id, input.id),
						eq(recurringExpenses.workspaceId, input.workspaceId),
					),
				);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string(), workspaceId: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(recurringExpenses)
				.where(
					and(
						eq(recurringExpenses.id, input.id),
						eq(recurringExpenses.workspaceId, input.workspaceId),
					),
				);
		}),
});
