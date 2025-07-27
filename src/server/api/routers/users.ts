import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
import { users } from "grandeo/server/db/schema";

export const usersRouter = createTRPCRouter({
	// Create or update user (called after Clerk auth)
	upsert: protectedProcedure
		.input(
			z.object({
				email: z.string().email(),
				firstName: z.string().optional(),
				lastName: z.string().optional(),
				imageUrl: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingUser = await ctx.db
				.select()
				.from(users)
				.where(eq(users.id, ctx.auth.userId))
				.limit(1);

			if (existingUser.length > 0) {
				// Update existing user
				return ctx.db
					.update(users)
					.set({
						email: input.email,
						firstName: input.firstName,
						lastName: input.lastName,
						imageUrl: input.imageUrl,
						updatedAt: new Date(),
					})
					.where(eq(users.id, ctx.auth.userId));
			} else {
				// Create new user
				return ctx.db.insert(users).values({
					id: ctx.auth.userId,
					email: input.email,
					firstName: input.firstName,
					lastName: input.lastName,
					imageUrl: input.imageUrl,
				});
			}
		}),

	// Get current user
	me: protectedProcedure.query(({ ctx }) => {
		return ctx.db
			.select()
			.from(users)
			.where(eq(users.id, ctx.auth.userId))
			.limit(1)
			.then((res) => res[0]);
	}),
});
