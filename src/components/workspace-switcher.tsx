"use client";

import { useState } from "react";
import { Button } from "grandeo/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "grandeo/components/ui/dialog";
import { Input } from "grandeo/components/ui/input";
import { Label } from "grandeo/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import { Textarea } from "grandeo/components/ui/textarea";
import { api } from "grandeo/trpc/react";
import { useWorkspace } from "grandeo/components/workspace-provider";
import {
	CheckIcon,
	ChevronDownIcon,
	PlusIcon,
	BuildingIcon,
	SettingsIcon,
} from "lucide-react";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";

interface WorkspaceSwitcherProps {
	className?: string;
}

export function WorkspaceSwitcher({ className }: WorkspaceSwitcherProps) {
	const {
		currentWorkspaceId,
		workspaces,
		isLoading,
		switchWorkspace,
		refetchWorkspaces,
	} = useWorkspace();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newWorkspace, setNewWorkspace] = useState({
		name: "",
		description: "",
	});

	const createWorkspace = api.workspaces.create.useMutation({
		onSuccess: (workspace) => {
			refetchWorkspaces();
			setIsCreateDialogOpen(false);
			setNewWorkspace({ name: "", description: "" });
			// Switch to the new workspace if it was created successfully
			if (workspace) {
				switchWorkspace(workspace.id);
			}
		},
	});

	const currentWorkspace = workspaces?.find((w) => w.id === currentWorkspaceId);

	const handleWorkspaceChange = (workspaceId: string) => {
		switchWorkspace(workspaceId);
	};

	const handleCreateWorkspace = () => {
		if (newWorkspace.name.trim()) {
			createWorkspace.mutate({
				name: newWorkspace.name.trim(),
				description: newWorkspace.description.trim() || undefined,
			});
		}
	};

	if (isLoading) {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<BuildingIcon className="h-4 w-4" />
				<span className="text-sm">Loading workspaces...</span>
			</div>
		);
	}

	if (!workspaces || workspaces.length === 0) {
		return (
			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm" className="w-full justify-start">
						<PlusIcon className="mr-2 h-4 w-4" />
						Create Workspace
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Workspace</DialogTitle>
						<DialogDescription>
							Create a new workspace to organize your financial data.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="workspace-name">Name</Label>
							<Input
								id="workspace-name"
								placeholder="My Workspace"
								value={newWorkspace.name}
								onChange={(e) =>
									setNewWorkspace({ ...newWorkspace, name: e.target.value })
								}
							/>
						</div>
						<div>
							<Label htmlFor="workspace-description">
								Description (optional)
							</Label>
							<Textarea
								id="workspace-description"
								placeholder="Describe your workspace..."
								value={newWorkspace.description}
								onChange={(e) =>
									setNewWorkspace({
										...newWorkspace,
										description: e.target.value,
									})
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCreateDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateWorkspace}
							disabled={!newWorkspace.name.trim() || createWorkspace.isPending}
						>
							{createWorkspace.isPending ? "Creating..." : "Create Workspace"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<div className={`space-y-2 ${className}`}>
			<Select
				value={currentWorkspaceId || ""}
				onValueChange={handleWorkspaceChange}
			>
				<SelectTrigger className="w-full">
					<div className="flex items-center gap-2">
						<BuildingIcon className="h-4 w-4" />
						<SelectValue placeholder="Select workspace" className="text-left">
							{currentWorkspace?.name || "Select workspace"}
						</SelectValue>
					</div>
				</SelectTrigger>
				<SelectContent>
					{workspaces.map((workspace) => (
						<SelectItem key={workspace.id} value={workspace.id}>
							<div className="flex w-full items-center justify-between">
								<span>{workspace.name}</span>
								{workspace.id === currentWorkspaceId && (
									<CheckIcon className="ml-2 h-4 w-4" />
								)}
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="flex gap-2">
				<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 justify-start"
						>
							<PlusIcon className="mr-2 h-4 w-4" />
							Create
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create New Workspace</DialogTitle>
							<DialogDescription>
								Create a new workspace to organize your financial data.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label htmlFor="workspace-name">Name</Label>
								<Input
									id="workspace-name"
									placeholder="My Workspace"
									value={newWorkspace.name}
									onChange={(e) =>
										setNewWorkspace({ ...newWorkspace, name: e.target.value })
									}
								/>
							</div>
							<div>
								<Label htmlFor="workspace-description">
									Description (optional)
								</Label>
								<Textarea
									id="workspace-description"
									placeholder="Describe your workspace..."
									value={newWorkspace.description}
									onChange={(e) =>
										setNewWorkspace({
											...newWorkspace,
											description: e.target.value,
										})
									}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsCreateDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateWorkspace}
								disabled={
									!newWorkspace.name.trim() || createWorkspace.isPending
								}
							>
								{createWorkspace.isPending ? "Creating..." : "Create Workspace"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{currentWorkspaceId && currentWorkspace && (
					<WorkspaceSettingsDialog
						workspaceId={currentWorkspaceId}
						currentUserRole={currentWorkspace.role}
						trigger={
							<Button variant="outline" size="sm">
								<SettingsIcon className="h-4 w-4" />
							</Button>
						}
					/>
				)}
			</div>
		</div>
	);
}
