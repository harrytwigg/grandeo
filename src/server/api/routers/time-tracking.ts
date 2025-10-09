import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import { timeEntries } from "grandeo/server/db/schema";

export const timeTrackingRouter = createTRPCRouter({
	getAll: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				limit: z.number().min(1).max(100).default(50),
			}),
		)
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(timeEntries)
				.where(
					and(
						eq(timeEntries.workspaceId, input.workspaceId),
						eq(timeEntries.userId, ctx.auth.userId),
					),
				)
				.orderBy(desc(timeEntries.startTime))
				.limit(input.limit);
		}),

	getLatest: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			const latest = await ctx.db
				.select()
				.from(timeEntries)
				.where(
					and(
						eq(timeEntries.workspaceId, input.workspaceId),
						eq(timeEntries.userId, ctx.auth.userId),
					),
				)
				.orderBy(desc(timeEntries.startTime))
				.limit(1);

			return latest[0] ?? null;
		}),

	getByDateRange: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				startDate: z.date(),
				endDate: z.date(),
			}),
		)
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(timeEntries)
				.where(
					and(
						eq(timeEntries.workspaceId, input.workspaceId),
						eq(timeEntries.userId, ctx.auth.userId),
						gte(timeEntries.startTime, input.startDate),
						lte(timeEntries.startTime, input.endDate),
					),
				)
				.orderBy(desc(timeEntries.startTime));
		}),

	create: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				description: z.string().min(1, "Description is required").trim(),
				moneyValue: z.number().min(1).max(4),
				isEnergizing: z.boolean(),
				startTime: z.date().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// If no start time provided, auto-calculate from last entry's end time or current time
			let calculatedStartTime = input.startTime;

			if (!calculatedStartTime) {
				const lastEntry = await ctx.db
					.select()
					.from(timeEntries)
					.where(
						and(
							eq(timeEntries.workspaceId, input.workspaceId),
							eq(timeEntries.userId, ctx.auth.userId),
						),
					)
					.orderBy(desc(timeEntries.startTime))
					.limit(1);

				if (lastEntry[0]?.endTime) {
					calculatedStartTime = lastEntry[0].endTime;
				} else if (lastEntry[0]?.startTime) {
					// If last entry has no end time, use current time
					calculatedStartTime = new Date();
				} else {
					calculatedStartTime = new Date();
				}
			}

			// Auto-set end time to now (current time)
			const endTime = new Date();
        console.log({
									workspaceId: input.workspaceId,
									userId: ctx.auth.userId,
									description: input.description,
									moneyValue: input.moneyValue,
									isEnergizing: input.isEnergizing,
									startTime: calculatedStartTime,
									endTime: endTime,
								});

			const result = await ctx.db
				.insert(timeEntries)
				.values({
					workspaceId: input.workspaceId,
					userId: ctx.auth.userId,
					description: input.description,
					moneyValue: input.moneyValue,
					isEnergizing: input.isEnergizing,
					startTime: calculatedStartTime,
					endTime: endTime,
				})
				.returning();

			return result[0];
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				description: z.string().min(1, "Description is required").optional(),
				moneyValue: z.number().min(1).max(4).optional(),
				isEnergizing: z.boolean().optional(),
				startTime: z.date().optional(),
				endTime: z.date().optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
			const { id, ...updateData } = input;

			return ctx.db
				.update(timeEntries)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(
					and(eq(timeEntries.id, id), eq(timeEntries.userId, ctx.auth.userId)),
				);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => {
			return ctx.db
				.delete(timeEntries)
				.where(
					and(
						eq(timeEntries.id, input.id),
						eq(timeEntries.userId, ctx.auth.userId),
					),
				);
		}),

	getStats: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				startDate: z.date(),
				endDate: z.date(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const entries = await ctx.db
				.select()
				.from(timeEntries)
				.where(
					and(
						eq(timeEntries.workspaceId, input.workspaceId),
						eq(timeEntries.userId, ctx.auth.userId),
						gte(timeEntries.startTime, input.startDate),
						lte(timeEntries.startTime, input.endDate),
					),
				);

			const totalEntries = entries.length;
			const totalMinutes = entries.reduce((sum, entry) => {
				if (!entry.endTime) return sum;
				const duration =
					(entry.endTime.getTime() - entry.startTime.getTime()) / (1000 * 60);
				return sum + duration;
			}, 0);

			const energizingCount = entries.filter((e) => e.isEnergizing).length;
			const drainingCount = entries.filter((e) => !e.isEnergizing).length;

			const avgMoneyValue =
				totalEntries > 0
					? entries.reduce((sum, e) => sum + e.moneyValue, 0) / totalEntries
					: 0;

			// Calculate time by money value quadrant
			const quadrantTime: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
			for (const entry of entries) {
				if (!entry.endTime) continue;
				const duration =
					(entry.endTime.getTime() - entry.startTime.getTime()) / (1000 * 60);
				quadrantTime[entry.moneyValue] =
					(quadrantTime[entry.moneyValue] ?? 0) + duration;
			}

			return {
				totalEntries,
				totalMinutes: Math.round(totalMinutes),
				totalHours: Math.round((totalMinutes / 60) * 10) / 10,
				energizingCount,
				drainingCount,
				avgMoneyValue: Math.round(avgMoneyValue * 10) / 10,
				quadrantTime,
			};
		}),
});
