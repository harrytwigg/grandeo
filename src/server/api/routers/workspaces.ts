import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
} from "grandeo/server/api/trpc";
import {
	workspaces,
	workspaceMemberships,
	users,
} from "grandeo/server/db/schema";

export const workspacesRouter = createTRPCRouter({
	// Get all workspaces for current user
	getAll: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select({
				id: workspaces.id,
				name: workspaces.name,
				description: workspaces.description,
				createdAt: workspaces.createdAt,
				role: workspaceMemberships.role,
			})
			.from(workspaceMemberships)
			.innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
			.where(eq(workspaceMemberships.userId, ctx.auth.userId));
	}),

	// Get a specific workspace
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const workspace = await ctx.db
				.select({
					id: workspaces.id,
					name: workspaces.name,
					description: workspaces.description,
					createdBy: workspaces.createdBy,
					createdAt: workspaces.createdAt,
					role: workspaceMemberships.role,
				})
				.from(workspaceMemberships)
				.innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.id),
						eq(workspaceMemberships.userId, ctx.auth.userId),
					),
				)
				.limit(1);

			return workspace[0];
		}),

	// Create a new workspace
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required").trim(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Create the workspace
			const workspace = await ctx.db
				.insert(workspaces)
				.values({
					name: input.name,
					description: input.description,
					createdBy: ctx.auth.userId,
				})
				.returning();

			const workspaceId = workspace[0]?.id;
			if (!workspaceId) {
				throw new Error("Failed to create workspace");
			}

			// Add the creator as an admin member
			await ctx.db.insert(workspaceMemberships).values({
				workspaceId,
				userId: ctx.auth.userId,
				role: "admin",
			});

			return workspace[0];
		}),

	// Update workspace
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required").trim(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin of this workspace
			const membership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.id),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (membership.length === 0) {
				throw new Error("Not authorized to update this workspace");
			}

			return ctx.db
				.update(workspaces)
				.set({
					name: input.name,
					description: input.description,
					updatedAt: new Date(),
				})
				.where(eq(workspaces.id, input.id));
		}),

	// Delete workspace (admin only)
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin of this workspace
			const membership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.id),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (membership.length === 0) {
				throw new Error("Not authorized to delete this workspace");
			}

			// Delete workspace (cascades to memberships due to foreign key)
			return ctx.db.delete(workspaces).where(eq(workspaces.id, input.id));
		}),

	// Get workspace members
	getMembers: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Check if user is member of this workspace
			const userMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
					),
				)
				.limit(1);

			if (userMembership.length === 0) {
				throw new Error("Not a member of this workspace");
			}

			return ctx.db
				.select({
					id: workspaceMemberships.id,
					role: workspaceMemberships.role,
					createdAt: workspaceMemberships.createdAt,
					user: {
						id: users.id,
						email: users.email,
						firstName: users.firstName,
						lastName: users.lastName,
						imageUrl: users.imageUrl,
					},
				})
				.from(workspaceMemberships)
				.innerJoin(users, eq(workspaceMemberships.userId, users.id))
				.where(eq(workspaceMemberships.workspaceId, input.workspaceId));
		}),
});
