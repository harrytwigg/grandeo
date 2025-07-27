"use client";

import { DashboardLayout } from "grandeo/components/dashboard-layout";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "grandeo/components/ui/alert-dialog";
import { Badge } from "grandeo/components/ui/badge";
import { Button } from "grandeo/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import {
	CalendarIcon,
	EditIcon,
	PlusIcon,
	TagIcon,
	TrashIcon,
} from "lucide-react";
import { useState } from "react";

export default function CategoriesPage() {
	const workspaceApi = useWorkspaceApi();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [newCategoryName, setNewCategoryName] = useState("");

	// TRPC queries and mutations using workspace-scoped API
	const {
		data: categories,
		isLoading,
		refetch,
	} = workspaceApi.expenseCategories.getAll();

	const createCategory = workspaceApi.expenseCategories.create();
	const updateCategory = workspaceApi.expenseCategories.update();
	const deleteCategory = workspaceApi.expenseCategories.delete();

	const handleCreateCategory = () => {
		if (newCategoryName.trim() && workspaceApi.workspaceId) {
			createCategory.mutate({ 
				name: newCategoryName.trim(),
				workspaceId: workspaceApi.workspaceId
			});
		}
	};

	const handleEditCategory = (category: { id: string; name: string }) => {
		setEditingCategory(category);
		setIsEditDialogOpen(true);
	};

	const handleUpdateCategory = () => {
		if (editingCategory?.name.trim() && workspaceApi.workspaceId) {
			updateCategory.mutate({
				id: editingCategory.id,
				name: editingCategory.name.trim(),
				workspaceId: workspaceApi.workspaceId,
			});
		}
	};

	const handleDeleteCategory = (id: string) => {
		if (workspaceApi.workspaceId) {
			deleteCategory.mutate({ 
				id,
				workspaceId: workspaceApi.workspaceId,
			});
		}
	};

	if (isLoading) {
		return (
			<DashboardLayout title="Expense Categories" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-muted-foreground">Loading categories...</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout title="Expense Categories" showAddButton={false}>
			<div className="space-y-6">
				{/* Header Section */}
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h1 className="font-bold text-2xl">Expense Categories</h1>
						<p className="text-muted-foreground">
							Manage your sexpense categories to better organize your spending.
						</p>
					</div>
					<Dialog
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}
					>
						<DialogTrigger asChild>
							<Button className="gap-2">
								<PlusIcon className="h-4 w-4" />
								Add Category
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Category</DialogTitle>
								<DialogDescription>
									Add a new expense category to organize your spending.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label htmlFor="categoryName">Category Name</Label>
									<Input
										id="categoryName"
										placeholder="e.g., Food, Transport, Entertainment"
										value={newCategoryName}
										onChange={(e) => setNewCategoryName(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" && handleCreateCategory()
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
									onClick={handleCreateCategory}
									disabled={!newCategoryName.trim() || createCategory.isPending}
								>
									{createCategory.isPending ? "Creating..." : "Create Category"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				{/* Stats Cards */}
				<div className="grid gap-4 md:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Total Categories
							</CardTitle>
							<TagIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{categories?.length ?? 0}
							</div>
							<p className="text-muted-foreground text-xs">
								Active expense categories
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Most Recent</CardTitle>
							<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{categories && categories.length > 0
									? categories[categories.length - 1]?.name
									: "None"}
							</div>
							<p className="text-muted-foreground text-xs">
								Latest category added
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Quick Actions
							</CardTitle>
							<PlusIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={() => setIsCreateDialogOpen(true)}
							>
								Add New Category
							</Button>
						</CardContent>
					</Card>
				</div>

				{/* Categories Table */}
				<Card>
					<CardHeader>
						<CardTitle>Categories</CardTitle>
						<CardDescription>
							View and manage all your expense categories.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{categories && categories.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Updated</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{categories.map((category) => (
										<TableRow key={category.id}>
											<TableCell className="font-medium">
												<div className="flex items-center gap-2">
													<Badge variant="secondary">
														<TagIcon className="mr-1 h-3 w-3" />
														{category.name}
													</Badge>
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{category.createdAt 
													? new Date(category.createdAt).toLocaleDateString()
													: "N/A"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{category.updatedAt
													? new Date(category.updatedAt).toLocaleDateString()
													: "Never"}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleEditCategory(category)}
													>
														<EditIcon className="h-4 w-4" />
													</Button>
													<AlertDialog>
														<AlertDialogTrigger asChild>
															<Button variant="destructive" size="sm">
																<TrashIcon className="h-4 w-4" />
															</Button>
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>
																	Delete Category
																</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete "
																	{category.name}"? This action cannot be
																	undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() =>
																		handleDeleteCategory(category.id)
																	}
																>
																	Delete
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<div className="py-12 text-center">
								<TagIcon className="mx-auto h-12 w-12 text-muted-foreground" />
								<h3 className="mt-4 font-semibold text-lg">
									No categories yet
								</h3>
								<p className="mb-4 text-muted-foreground">
									Get started by creating your first expense category.
								</p>
								<Button onClick={() => setIsCreateDialogOpen(true)}>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Your First Category
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Edit Dialog */}
				<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit Category</DialogTitle>
							<DialogDescription>
								Update the name of this expense category.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="editCategoryName">Category Name</Label>
								<Input
									id="editCategoryName"
									placeholder="e.g., Food, Transport, Entertainment"
									value={editingCategory?.name ?? ""}
									onChange={(e) =>
										setEditingCategory((prev) =>
											prev ? { ...prev, name: e.target.value } : null,
										)
									}
									onKeyDown={(e) => e.key === "Enter" && handleUpdateCategory()}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsEditDialogOpen(false);
									setEditingCategory(null);
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleUpdateCategory}
								disabled={
									!editingCategory?.name.trim() || updateCategory.isPending
								}
							>
								{updateCategory.isPending ? "Updating..." : "Update Category"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</DashboardLayout>
	);
}
