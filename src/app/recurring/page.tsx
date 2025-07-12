"use client";

import { useState } from "react";
import { DashboardLayout } from "grandeo/components/dashboard-layout";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import { Button } from "grandeo/components/ui/button";
import { Input } from "grandeo/components/ui/input";
import { Label } from "grandeo/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "grandeo/components/ui/dialog";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { Badge } from "grandeo/components/ui/badge";
import {
	PlusIcon,
	EditIcon,
	TrashIcon,
	TrendingUpIcon,
	CalendarIcon,
	PoundSterlingIcon,
} from "lucide-react";
import { api } from "grandeo/trpc/react";

interface RecurringExpense {
	id: string;
	name: string;
	amountInPounds: number;
	startDate: Date;
	endDate?: Date | null;
	frequency: string;
	createdAt: Date | null;
	updatedAt: Date | null;
	expenseCategory: {
		id: string;
		name: string;
	} | null;
	currentAccount: {
		id: string;
		name: string;
	} | null;
}

export default function RecurringExpensesPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(
		null,
	);
	const [formData, setFormData] = useState({
		name: "",
		amountInPounds: "",
		expenseCategoryId: "",
		currentAccountId: "",
		startDate: "",
		endDate: "",
		frequency: "",
	});

	// TRPC queries and mutations
	const {
		data: expenses,
		isLoading,
		refetch,
	} = api.recurringExpenses.getAll.useQuery();

	const { data: categories } = api.expenseCategories.getAll.useQuery();
	const { data: accounts } = api.currentAccounts.getAll.useQuery();

	const createExpense = api.recurringExpenses.create.useMutation({
		onSuccess: () => {
			refetch();
			setIsCreateDialogOpen(false);
			resetForm();
		},
	});

	const updateExpense = api.recurringExpenses.update.useMutation({
		onSuccess: () => {
			refetch();
			setIsEditDialogOpen(false);
			setEditingExpense(null);
			resetForm();
		},
	});

	const deleteExpense = api.recurringExpenses.delete.useMutation({
		onSuccess: () => {
			refetch();
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			amountInPounds: "",
			expenseCategoryId: "",
			currentAccountId: "",
			startDate: "",
			endDate: "",
			frequency: "",
		});
	};

	const handleCreateExpense = () => {
		if (
			formData.name &&
			formData.amountInPounds &&
			formData.expenseCategoryId &&
			formData.currentAccountId &&
			formData.startDate &&
			formData.frequency
		) {
			createExpense.mutate({
				name: formData.name,
				amountInPounds: Number.parseFloat(formData.amountInPounds),
				expenseCategoryId: formData.expenseCategoryId,
				currentAccountId: formData.currentAccountId,
				startDate: new Date(formData.startDate),
				endDate: formData.endDate ? new Date(formData.endDate) : undefined,
				frequency: formData.frequency as
					| "daily"
					| "weekly"
					| "monthly"
					| "annually",
			});
		}
	};

	const handleEditExpense = (expense: RecurringExpense) => {
		setEditingExpense(expense);
		setFormData({
			name: expense.name,
			amountInPounds: expense.amountInPounds.toString(),
			expenseCategoryId: expense.expenseCategory?.id || "",
			currentAccountId: expense.currentAccount?.id || "",
			startDate: expense.startDate
				? (new Date(expense.startDate).toISOString().split("T")[0] ?? "")
				: "",
			endDate: expense.endDate
				? (new Date(expense.endDate).toISOString().split("T")[0] ?? "")
				: "",
			frequency: expense.frequency,
		});
		setIsEditDialogOpen(true);
	};

	const handleUpdateExpense = () => {
		if (
			editingExpense &&
			formData.name &&
			formData.amountInPounds &&
			formData.expenseCategoryId &&
			formData.currentAccountId &&
			formData.startDate &&
			formData.frequency
		) {
			updateExpense.mutate({
				id: editingExpense.id,
				name: formData.name,
				amountInPounds: Number.parseFloat(formData.amountInPounds),
				expenseCategoryId: formData.expenseCategoryId,
				currentAccountId: formData.currentAccountId,
				startDate: new Date(formData.startDate),
				endDate: formData.endDate ? new Date(formData.endDate) : undefined,
				frequency: formData.frequency as
					| "daily"
					| "weekly"
					| "monthly"
					| "annually",
			});
		}
	};

	const handleDeleteExpense = (id: string) => {
		deleteExpense.mutate({ id });
	};

	const formatFrequency = (frequency: string) => {
		return frequency.charAt(0).toUpperCase() + frequency.slice(1);
	};

	const getFrequencyColor = (frequency: string) => {
		switch (frequency) {
			case "daily":
				return "bg-red-100 text-red-800";
			case "weekly":
				return "bg-orange-100 text-orange-800";
			case "monthly":
				return "bg-blue-100 text-blue-800";
			case "annually":
				return "bg-green-100 text-green-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	if (isLoading) {
		return (
			<DashboardLayout title="Recurring Expenses" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-muted-foreground">
						Loading recurring expenses...
					</div>
				</div>
			</DashboardLayout>
		);
	}

	const totalMonthlyAmount =
		expenses?.reduce((sum, expense) => {
			const multiplier =
				expense.frequency === "daily"
					? 30
					: expense.frequency === "weekly"
						? 4.33
						: expense.frequency === "monthly"
							? 1
							: expense.frequency === "annually"
								? 1 / 12
								: 1;
			return sum + expense.amountInPounds * multiplier;
		}, 0) || 0;

	return (
		<DashboardLayout title="Recurring Expenses" showAddButton={false}>
			<div className="space-y-6">
				{/* Header Section */}
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h1 className="font-bold text-2xl">Recurring Expenses</h1>
						<p className="text-muted-foreground">
							Manage your recurring expenses and subscriptions.
						</p>
					</div>
					<Dialog
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}
					>
						<DialogTrigger asChild>
							<Button className="gap-2">
								<PlusIcon className="h-4 w-4" />
								Add Expense
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>Create New Recurring Expense</DialogTitle>
								<DialogDescription>
									Add a new recurring expense or subscription.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="name" className="text-right">
										Name
									</Label>
									<Input
										id="name"
										placeholder="e.g., Netflix Subscription"
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										className="col-span-3"
									/>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="amount" className="text-right">
										Amount (£)
									</Label>
									<Input
										id="amount"
										type="number"
										step="0.01"
										placeholder="12.99"
										value={formData.amountInPounds}
										onChange={(e) =>
											setFormData({
												...formData,
												amountInPounds: e.target.value,
											})
										}
										className="col-span-3"
									/>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="category" className="text-right">
										Category
									</Label>
									<Select
										value={formData.expenseCategoryId}
										onValueChange={(value) =>
											setFormData({ ...formData, expenseCategoryId: value })
										}
									>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											{categories?.map((category) => (
												<SelectItem key={category.id} value={category.id}>
													{category.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="account" className="text-right">
										Account
									</Label>
									<Select
										value={formData.currentAccountId}
										onValueChange={(value) =>
											setFormData({ ...formData, currentAccountId: value })
										}
									>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select account" />
										</SelectTrigger>
										<SelectContent>
											{accounts?.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="frequency" className="text-right">
										Frequency
									</Label>
									<Select
										value={formData.frequency}
										onValueChange={(value) =>
											setFormData({ ...formData, frequency: value })
										}
									>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select frequency" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="daily">Daily</SelectItem>
											<SelectItem value="weekly">Weekly</SelectItem>
											<SelectItem value="monthly">Monthly</SelectItem>
											<SelectItem value="annually">Annually</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="startDate" className="text-right">
										Start Date
									</Label>
									<Input
										id="startDate"
										type="date"
										value={formData.startDate}
										onChange={(e) =>
											setFormData({ ...formData, startDate: e.target.value })
										}
										className="col-span-3"
									/>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="endDate" className="text-right">
										End Date (Optional)
									</Label>
									<Input
										id="endDate"
										type="date"
										value={formData.endDate}
										onChange={(e) =>
											setFormData({ ...formData, endDate: e.target.value })
										}
										className="col-span-3"
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setIsCreateDialogOpen(false);
										resetForm();
									}}
								>
									Cancel
								</Button>
								<Button
									onClick={handleCreateExpense}
									disabled={createExpense.isPending}
								>
									{createExpense.isPending ? "Creating..." : "Create Expense"}
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
								Total Expenses
							</CardTitle>
							<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{expenses?.length ?? 0}</div>
							<p className="text-muted-foreground text-xs">
								Active recurring expenses
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Monthly Total
							</CardTitle>
							<PoundSterlingIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								£{totalMonthlyAmount.toFixed(2)}
							</div>
							<p className="text-muted-foreground text-xs">
								Estimated monthly spending
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
								Add New Expense
							</Button>
						</CardContent>
					</Card>
				</div>

				{/* Expenses Table */}
				<Card>
					<CardHeader>
						<CardTitle>Recurring Expenses</CardTitle>
						<CardDescription>
							View and manage all your recurring expenses. These are used for
							forecasting.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{expenses && expenses.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Frequency</TableHead>
										<TableHead>Category</TableHead>
										<TableHead>Account</TableHead>
										<TableHead>Start Date</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{expenses.map((expense) => (
										<TableRow key={expense.id}>
											<TableCell className="font-medium">
												{expense.name}
											</TableCell>
											<TableCell>
												£{expense.amountInPounds.toFixed(2)}
											</TableCell>
											<TableCell>
												<Badge className={getFrequencyColor(expense.frequency)}>
													{formatFrequency(expense.frequency)}
												</Badge>
											</TableCell>
											<TableCell>
												{expense.expenseCategory?.name || "Unknown"}
											</TableCell>
											<TableCell>
												{expense.currentAccount?.name || "Unknown"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{expense.startDate
													? new Date(expense.startDate).toLocaleDateString()
													: "Unknown"}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleEditExpense(expense)}
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
																	Delete Recurring Expense
																</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete "
																	{expense.name}"? This action cannot be undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() =>
																		handleDeleteExpense(expense.id)
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
								<TrendingUpIcon className="mx-auto h-12 w-12 text-muted-foreground" />
								<h3 className="mt-4 font-semibold text-lg">
									No recurring expenses yet
								</h3>
								<p className="mb-4 text-muted-foreground">
									Get started by adding your first recurring expense.
								</p>
								<Button onClick={() => setIsCreateDialogOpen(true)}>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Your First Expense
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Edit Dialog */}
				<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>Edit Recurring Expense</DialogTitle>
							<DialogDescription>
								Update this recurring expense or subscription.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editName" className="text-right">
									Name
								</Label>
								<Input
									id="editName"
									placeholder="e.g., Netflix Subscription"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editAmount" className="text-right">
									Amount (£)
								</Label>
								<Input
									id="editAmount"
									type="number"
									step="0.01"
									placeholder="12.99"
									value={formData.amountInPounds}
									onChange={(e) =>
										setFormData({ ...formData, amountInPounds: e.target.value })
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editCategory" className="text-right">
									Category
								</Label>
								<Select
									value={formData.expenseCategoryId}
									onValueChange={(value) =>
										setFormData({ ...formData, expenseCategoryId: value })
									}
								>
									<SelectTrigger className="col-span-3">
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										{categories?.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												{category.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editAccount" className="text-right">
									Account
								</Label>
								<Select
									value={formData.currentAccountId}
									onValueChange={(value) =>
										setFormData({ ...formData, currentAccountId: value })
									}
								>
									<SelectTrigger className="col-span-3">
										<SelectValue placeholder="Select account" />
									</SelectTrigger>
									<SelectContent>
										{accounts?.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editFrequency" className="text-right">
									Frequency
								</Label>
								<Select
									value={formData.frequency}
									onValueChange={(value) =>
										setFormData({ ...formData, frequency: value })
									}
								>
									<SelectTrigger className="col-span-3">
										<SelectValue placeholder="Select frequency" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="daily">Daily</SelectItem>
										<SelectItem value="weekly">Weekly</SelectItem>
										<SelectItem value="monthly">Monthly</SelectItem>
										<SelectItem value="annually">Annually</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editStartDate" className="text-right">
									Start Date
								</Label>
								<Input
									id="editStartDate"
									type="date"
									value={formData.startDate}
									onChange={(e) =>
										setFormData({ ...formData, startDate: e.target.value })
									}
									className="col-span-3"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="editEndDate" className="text-right">
									End Date (Optional)
								</Label>
								<Input
									id="editEndDate"
									type="date"
									value={formData.endDate}
									onChange={(e) =>
										setFormData({ ...formData, endDate: e.target.value })
									}
									className="col-span-3"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsEditDialogOpen(false);
									setEditingExpense(null);
									resetForm();
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleUpdateExpense}
								disabled={updateExpense.isPending}
							>
								{updateExpense.isPending ? "Updating..." : "Update Expense"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</DashboardLayout>
	);
}
