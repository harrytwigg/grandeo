"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { Settings, Save, Trash2, LogOut, Users } from "lucide-react";
import { WorkspaceMembersDialog } from "./workspace-members-dialog";

const workspaceSchema = z.object({
	name: z.string().min(1, "Name is required").trim(),
	description: z.string().optional(),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

interface WorkspaceSettingsDialogProps {
	workspaceId: string;
	currentUserRole: string;
	trigger?: React.ReactNode;
}

export function WorkspaceSettingsDialog({
	workspaceId,
	currentUserRole,
	trigger,
}: WorkspaceSettingsDialogProps) {
	const [open, setOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

	const router = useRouter();
	const utils = api.useUtils();

	const { data: workspace } = api.workspaces.getById.useQuery(
		{ id: workspaceId },
		{ enabled: open },
	);

	const updateWorkspaceMutation = api.workspaces.update.useMutation({
		onSuccess: () => {
			toast.success("Workspace updated successfully");
			utils.workspaces.getAll.invalidate();
			utils.workspaces.getById.invalidate({ id: workspaceId });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteWorkspaceMutation = api.workspaces.delete.useMutation({
		onSuccess: () => {
			toast.success("Workspace deleted successfully");
			setDeleteDialogOpen(false);
			setOpen(false);
			utils.workspaces.getAll.invalidate();
			router.push("/");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const leaveWorkspaceMutation = api.workspaces.leaveWorkspace.useMutation({
		onSuccess: () => {
			toast.success("Left workspace successfully");
			setLeaveDialogOpen(false);
			setOpen(false);
			utils.workspaces.getAll.invalidate();
			router.push("/");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const form = useForm<WorkspaceForm>({
		resolver: zodResolver(workspaceSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	// Update form when workspace data loads
	if (workspace && form.getValues().name !== workspace.name) {
		form.reset({
			name: workspace.name,
			description: workspace.description || "",
		});
	}

	const onSubmit = (data: WorkspaceForm) => {
		updateWorkspaceMutation.mutate({
			id: workspaceId,
			name: data.name,
			description: data.description,
		});
	};

	const handleDeleteWorkspace = () => {
		deleteWorkspaceMutation.mutate({ id: workspaceId });
	};

	const handleLeaveWorkspace = () => {
		leaveWorkspaceMutation.mutate({ workspaceId });
	};

	const isAdmin = currentUserRole === "admin";

	return (
		<>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					{trigger || (
						<Button variant="outline" size="sm">
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</Button>
					)}
				</DialogTrigger>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Workspace Settings
						</DialogTitle>
						<DialogDescription>
							Manage workspace details and settings.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-6">
						{/* Workspace Details */}
						<div className="space-y-4">
							<div>
								<h3 className="font-medium text-lg">Workspace Details</h3>
								<p className="text-muted-foreground text-sm">
									Update your workspace name and description.
								</p>
							</div>

							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-4"
								>
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Workspace Name</FormLabel>
												<FormControl>
													<Input
														placeholder="Enter workspace name"
														{...field}
														disabled={!isAdmin}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="description"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Description</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Enter workspace description (optional)"
														{...field}
														disabled={!isAdmin}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{isAdmin && (
										<div className="flex justify-end">
											<Button
												type="submit"
												disabled={updateWorkspaceMutation.isPending}
											>
												<Save className="mr-2 h-4 w-4" />
												{updateWorkspaceMutation.isPending
													? "Saving..."
													: "Save Changes"}
											</Button>
										</div>
									)}
								</form>
							</Form>
						</div>

						<Separator />

						{/* Team Management */}
						<div className="space-y-4">
							<div>
								<h3 className="font-medium text-lg">Team Management</h3>
								<p className="text-muted-foreground text-sm">
									Manage workspace members and their roles.
								</p>
							</div>

							<WorkspaceMembersDialog
								workspaceId={workspaceId}
								currentUserRole={currentUserRole}
								trigger={
									<Button variant="outline" className="w-full">
										<Users className="mr-2 h-4 w-4" />
										Manage Members
									</Button>
								}
							/>
						</div>

						<Separator />

						{/* Danger Zone */}
						<div className="space-y-4">
							<div>
								<h3 className="font-medium text-destructive text-lg">
									Danger Zone
								</h3>
								<p className="text-muted-foreground text-sm">
									Irreversible and destructive actions.
								</p>
							</div>

							<div className="space-y-3">
								{/* Leave Workspace */}
								<div className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
									<div>
										<h4 className="font-medium text-sm">Leave Workspace</h4>
										<p className="text-muted-foreground text-sm">
											Remove yourself from this workspace.
										</p>
									</div>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setLeaveDialogOpen(true)}
									>
										<LogOut className="mr-2 h-4 w-4" />
										Leave
									</Button>
								</div>

								{/* Delete Workspace (Admin only) */}
								{isAdmin && (
									<div className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
										<div>
											<h4 className="font-medium text-sm">Delete Workspace</h4>
											<p className="text-muted-foreground text-sm">
												Permanently delete this workspace and all its data.
											</p>
										</div>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => setDeleteDialogOpen(true)}
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Delete
										</Button>
									</div>
								)}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Workspace Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Workspace</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this workspace? This action cannot
							be undone and will permanently delete all workspace data,
							including accounts, transactions, and member access.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteWorkspace}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteWorkspaceMutation.isPending}
						>
							{deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Leave Workspace Confirmation Dialog */}
			<AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Leave Workspace</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to leave this workspace? You will lose
							access to all workspace data and will need to be re-invited to
							rejoin.
							{currentUserRole === "admin" &&
								" As an admin, make sure to transfer admin rights to another member first if you are the only admin."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleLeaveWorkspace}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={leaveWorkspaceMutation.isPending}
						>
							{leaveWorkspaceMutation.isPending ? "Leaving..." : "Leave"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
