"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "grandeo/trpc/react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "./ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Separator } from "./ui/separator";
import {
	Users,
	Plus,
	Settings,
	Trash2,
	Crown,
	User,
	Mail,
	MoreHorizontal,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const inviteUserSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	role: z.enum(["admin", "member"]).default("member"),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;

interface WorkspaceMembersDialogProps {
	workspaceId: string;
	currentUserRole: string;
	trigger?: React.ReactNode;
}

export function WorkspaceMembersDialog({
	workspaceId,
	currentUserRole,
	trigger,
}: WorkspaceMembersDialogProps) {
	const [open, setOpen] = useState(false);
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const utils = api.useUtils();

	const { data: members, isLoading } = api.workspaces.getMembers.useQuery(
		{ workspaceId },
		{ enabled: open },
	);

	const inviteUserMutation = api.workspaces.inviteUser.useMutation({
		onSuccess: () => {
			toast.success("User invited successfully");
			setInviteDialogOpen(false);
			form.reset();
			utils.workspaces.getMembers.invalidate({ workspaceId });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const updateRoleMutation = api.workspaces.updateUserRole.useMutation({
		onSuccess: () => {
			toast.success("User role updated successfully");
			utils.workspaces.getMembers.invalidate({ workspaceId });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const removeUserMutation = api.workspaces.removeUser.useMutation({
		onSuccess: () => {
			toast.success("User removed from workspace");
			setRemoveDialogOpen(false);
			setSelectedUserId(null);
			utils.workspaces.getMembers.invalidate({ workspaceId });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const form = useForm<InviteUserForm>({
		resolver: zodResolver(inviteUserSchema),
		defaultValues: {
			email: "",
			role: "member",
		},
	});

	const onInviteSubmit = (data: InviteUserForm) => {
		inviteUserMutation.mutate({
			workspaceId,
			email: data.email,
			role: data.role,
		});
	};

	const handleRoleChange = (userId: string, newRole: "admin" | "member") => {
		updateRoleMutation.mutate({
			workspaceId,
			userId,
			role: newRole,
		});
	};

	const handleRemoveUser = () => {
		if (selectedUserId) {
			removeUserMutation.mutate({
				workspaceId,
				userId: selectedUserId,
			});
		}
	};

	const isAdmin = currentUserRole === "admin";

	return (
		<>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					{trigger || (
						<Button variant="outline" size="sm">
							<Users className="mr-2 h-4 w-4" />
							Manage Members
						</Button>
					)}
				</DialogTrigger>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Workspace Members
						</DialogTitle>
						<DialogDescription>
							View and manage members of this workspace.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{/* Add Member Button */}
						{isAdmin && (
							<div className="flex items-center justify-between">
								<div>
									<h3 className="font-medium text-sm">Team Members</h3>
									<p className="text-muted-foreground text-sm">
										{members?.length || 0} member
										{members?.length !== 1 ? "s" : ""}
									</p>
								</div>
								<Button onClick={() => setInviteDialogOpen(true)} size="sm">
									<Plus className="mr-2 h-4 w-4" />
									Invite Member
								</Button>
							</div>
						)}

						<Separator />

						{/* Members List */}
						<div className="max-h-96 space-y-3 overflow-y-auto">
							{isLoading ? (
								<div className="py-4 text-center">
									<p className="text-muted-foreground text-sm">
										Loading members...
									</p>
								</div>
							) : members?.length === 0 ? (
								<div className="py-4 text-center">
									<p className="text-muted-foreground text-sm">
										No members found
									</p>
								</div>
							) : (
								members?.map((member) => (
									<div
										key={member.id}
										className="flex items-center justify-between rounded-lg border p-3"
									>
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarImage src={member.user.imageUrl || ""} />
												<AvatarFallback>
													{member.user.firstName?.[0] ||
														member.user.email[0]?.toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div>
												<div className="flex items-center gap-2">
													<p className="font-medium text-sm">
														{member.user.firstName && member.user.lastName
															? `${member.user.firstName} ${member.user.lastName}`
															: member.user.email}
													</p>
													<Badge
														variant={
															member.role === "admin" ? "default" : "secondary"
														}
														className="text-xs"
													>
														{member.role === "admin" ? (
															<Crown className="mr-1 h-3 w-3" />
														) : (
															<User className="mr-1 h-3 w-3" />
														)}
														{member.role}
													</Badge>
												</div>
												<div className="flex items-center gap-1 text-muted-foreground text-xs">
													<Mail className="h-3 w-3" />
													{member.user.email}
												</div>
											</div>
										</div>

										{isAdmin && (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="sm">
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() =>
															handleRoleChange(
																member.user.id,
																member.role === "admin" ? "member" : "admin",
															)
														}
														disabled={updateRoleMutation.isPending}
													>
														<Settings className="mr-2 h-4 w-4" />
														{member.role === "admin"
															? "Make Member"
															: "Make Admin"}
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() => {
															setSelectedUserId(member.user.id);
															setRemoveDialogOpen(true);
														}}
														className="text-destructive"
														disabled={removeUserMutation.isPending}
													>
														<Trash2 className="mr-2 h-4 w-4" />
														Remove Member
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										)}
									</div>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Invite User Dialog */}
			<Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite Member</DialogTitle>
						<DialogDescription>
							Invite a new member to this workspace by their email address.
						</DialogDescription>
					</DialogHeader>

					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onInviteSubmit)}
							className="space-y-4"
						>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email Address</FormLabel>
										<FormControl>
											<Input
												placeholder="user@example.com"
												type="email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="role"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Role</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a role" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="member">
													<div className="flex items-center gap-2">
														<User className="h-4 w-4" />
														Member
													</div>
												</SelectItem>
												<SelectItem value="admin">
													<div className="flex items-center gap-2">
														<Crown className="h-4 w-4" />
														Admin
													</div>
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setInviteDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={inviteUserMutation.isPending}>
									{inviteUserMutation.isPending ? "Inviting..." : "Invite"}
								</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>

			{/* Remove User Confirmation Dialog */}
			<AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove Member</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove this member from the workspace?
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRemoveUser}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={removeUserMutation.isPending}
						>
							{removeUserMutation.isPending ? "Removing..." : "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
