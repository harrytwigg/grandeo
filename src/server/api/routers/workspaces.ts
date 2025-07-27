import { z } from "zod";
import { and, eq, sql, notInArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "grandeo/server/api/trpc";
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
			.innerJoin(
				workspaces,
				eq(workspaceMemberships.workspaceId, workspaces.id),
			)
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
				.innerJoin(
					workspaces,
					eq(workspaceMemberships.workspaceId, workspaces.id),
				)
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

	// Invite user to workspace (admin only)
	inviteUser: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				email: z.string().email(),
				role: z.enum(["admin", "member"]).default("member"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin of this workspace
			const userMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (userMembership.length === 0) {
				throw new Error("Not authorized to invite users to this workspace");
			}

			// Find user by email
			const targetUser = await ctx.db
				.select()
				.from(users)
				.where(eq(users.email, input.email))
				.limit(1);

			if (targetUser.length === 0) {
				throw new Error("User with this email does not exist");
			}

			const targetUserId = targetUser[0]?.id;
			if (!targetUserId) {
				throw new Error("Invalid user data");
			}

			// Check if user is already a member
			const existingMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, targetUserId),
					),
				)
				.limit(1);

			if (existingMembership.length > 0) {
				throw new Error("User is already a member of this workspace");
			}

			// Add user to workspace
			return ctx.db.insert(workspaceMemberships).values({
				workspaceId: input.workspaceId,
				userId: targetUserId,
				role: input.role,
			});
		}),

	// Update user role in workspace (admin only)
	updateUserRole: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				userId: z.string(),
				role: z.enum(["admin", "member"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if current user is admin of this workspace
			const userMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (userMembership.length === 0) {
				throw new Error(
					"Not authorized to update user roles in this workspace",
				);
			}

			// Prevent user from changing their own role
			if (input.userId === ctx.auth.userId) {
				throw new Error("Cannot change your own role");
			}

			// Update user role
			return ctx.db
				.update(workspaceMemberships)
				.set({
					role: input.role,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, input.userId),
					),
				);
		}),

	// Remove user from workspace (admin only)
	removeUser: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if current user is admin of this workspace
			const userMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (userMembership.length === 0) {
				throw new Error("Not authorized to remove users from this workspace");
			}

			// Prevent user from removing themselves
			if (input.userId === ctx.auth.userId) {
				throw new Error("Cannot remove yourself from the workspace");
			}

			// Remove user from workspace
			return ctx.db
				.delete(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, input.userId),
					),
				);
		}),

	// Leave workspace (member can leave, but not if they're the only admin)
	leaveWorkspace: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get current user's membership
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
				throw new Error("You are not a member of this workspace");
			}

			const currentMembership = userMembership[0];
			if (!currentMembership) {
				throw new Error("Invalid membership data");
			}

			// If user is admin, check if there are other admins
			if (currentMembership.role === "admin") {
				const adminCount = await ctx.db
					.select()
					.from(workspaceMemberships)
					.where(
						and(
							eq(workspaceMemberships.workspaceId, input.workspaceId),
							eq(workspaceMemberships.role, "admin"),
						),
					);

				if (adminCount.length === 1) {
					throw new Error(
						"Cannot leave workspace as you are the only admin. Transfer admin role to another user first.",
					);
				}
			}

			// Remove user from workspace
			return ctx.db
				.delete(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
					),
				);
		}),

	// Search users by email for invitations
	searchUsers: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				email: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Check if user is admin of this workspace
			const userMembership = await ctx.db
				.select()
				.from(workspaceMemberships)
				.where(
					and(
						eq(workspaceMemberships.workspaceId, input.workspaceId),
						eq(workspaceMemberships.userId, ctx.auth.userId),
						eq(workspaceMemberships.role, "admin"),
					),
				)
				.limit(1);

			if (userMembership.length === 0) {
				throw new Error("Not authorized to search users for this workspace");
			}

			// Find users by email pattern (excluding current workspace members)
			const existingMemberIds = await ctx.db
				.select({ userId: workspaceMemberships.userId })
				.from(workspaceMemberships)
				.where(eq(workspaceMemberships.workspaceId, input.workspaceId));

			const memberIds = existingMemberIds.map((m) => m.userId);

			return ctx.db
				.select({
					id: users.id,
					email: users.email,
					firstName: users.firstName,
					lastName: users.lastName,
					imageUrl: users.imageUrl,
				})
				.from(users)
				.where(
					and(
						eq(users.email, input.email),
						memberIds.length > 0 ? notInArray(users.id, memberIds) : undefined,
					),
				)
				.limit(10);
		}),
});
