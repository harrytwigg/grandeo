import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "grandeo/server/api/trpc";
import { currentAccounts } from "grandeo/server/db/schema";
import { eq } from "drizzle-orm";

export const accountsRouter = createTRPCRouter({
	getAll: publicProcedure.query(({ ctx }) => {
		return ctx.db.select().from(currentAccounts);
	}),

	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.db
				.select()
				.from(currentAccounts)
				.where(eq(currentAccounts.id, input.id))
				.limit(1)
				.then((res) => res[0]);
		}),

	create: publicProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required").trim().toLowerCase(),
				accountType: z
					.enum(["current_account", "credit_card"])
					.default("current_account"),
			}),
		)
		.mutation(({ ctx, input }) => {
			return ctx.db.insert(currentAccounts).values({
				name: input.name,
				accountType: input.accountType,
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
});
