"use client";

import { Button } from "grandeo/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import { Input } from "grandeo/components/ui/input";
import { Label } from "grandeo/components/ui/label";
import { Textarea } from "grandeo/components/ui/textarea";
import { api } from "grandeo/trpc/react";
import { ArrowRightIcon, BuildingIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SelectWorkspacePage() {
	const router = useRouter();
	const [isCreating, setIsCreating] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const { data: workspaces, refetch } = api.workspaces.getAll.useQuery();
	const createWorkspace = api.workspaces.create.useMutation();

	const handleSelectWorkspace = (workspaceId: string) => {
		router.replace(`/?workspace=${workspaceId}`);
	};

	const handleCreateWorkspace = async () => {
		if (!name.trim() || createWorkspace.isPending) return;

		createWorkspace.mutate(
			{
				name: name.trim(),
				description: description.trim() || undefined,
			},
			{
				onSuccess: async (workspace) => {
					await refetch();
					router.replace(`/?workspace=${workspace.id}`);
				},
			},
		);
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
			<div className="w-full max-w-2xl space-y-8">
				<div className="text-center">
					<h1 className="font-bold text-3xl text-gray-900 tracking-tight">
						Select a Workspace
					</h1>
					<p className="mt-2 text-gray-600 text-sm">
						Choose an existing workspace or create a new one to continue
					</p>
				</div>

				{!isCreating && workspaces && workspaces.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Your Workspaces</CardTitle>
							<CardDescription>
								Select a workspace to access your data
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{workspaces.map((workspace) => (
								<button
									key={workspace.id}
									onClick={() => handleSelectWorkspace(workspace.id)}
									className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-gray-50"
								>
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
											<BuildingIcon className="h-5 w-5 text-blue-600" />
										</div>
										<div>
											<p className="font-medium">{workspace.name}</p>
											{workspace.description && (
												<p className="text-gray-600 text-sm">
													{workspace.description}
												</p>
											)}
											<p className="text-gray-500 text-xs">
												Role: {workspace.role}
											</p>
										</div>
									</div>
									<ArrowRightIcon className="h-5 w-5 text-gray-400" />
								</button>
							))}
						</CardContent>
					</Card>
				)}

				{!isCreating ? (
					<Card>
						<CardContent className="pt-6">
							<Button
								onClick={() => setIsCreating(true)}
								className="w-full"
								size="lg"
							>
								<PlusIcon className="mr-2 h-5 w-5" />
								Create New Workspace
							</Button>
						</CardContent>
					</Card>
				) : (
					<Card>
						<CardHeader>
							<CardTitle>Create New Workspace</CardTitle>
							<CardDescription>
								Set up a new workspace to organize your finances
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Workspace Name *</Label>
								<Input
									id="name"
									placeholder="e.g., Personal, Family, Business"
									value={name}
									onChange={(e) => setName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && name.trim()) {
											handleCreateWorkspace();
										}
									}}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description (Optional)</Label>
								<Textarea
									id="description"
									placeholder="What is this workspace for?"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
								/>
							</div>

							<div className="flex gap-3">
								<Button
									onClick={handleCreateWorkspace}
									disabled={!name.trim() || createWorkspace.isPending}
									className="flex-1"
								>
									{createWorkspace.isPending
										? "Creating..."
										: "Create Workspace"}
								</Button>
								<Button
									onClick={() => setIsCreating(false)}
									variant="outline"
									disabled={createWorkspace.isPending}
								>
									Cancel
								</Button>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
