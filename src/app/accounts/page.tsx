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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
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
	BuildingIcon,
	CalendarIcon,
	CreditCardIcon,
	EditIcon,
	EyeIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CurrentAccountsPage() {
	const workspaceApi = useWorkspaceApi();
	const router = useRouter();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<{
		id: string;
		name: string;
		accountType: string;
	} | null>(null);
	const [newAccountName, setNewAccountName] = useState("");
	const [newAccountType, setNewAccountType] = useState<
		"current_account" | "credit_card"
	>("current_account");

	// TRPC queries and mutations
	const {
		data: accounts,
		isLoading,
		refetch,
	} = workspaceApi.currentAccounts.getAll();

	const createAccount = workspaceApi.currentAccounts.create();
	const updateAccount = workspaceApi.currentAccounts.update();
	const deleteAccount = workspaceApi.currentAccounts.delete();

	const handleCreateAccount = () => {
		if (newAccountName.trim() && workspaceApi.workspaceId) {
			createAccount.mutate({
				name: newAccountName.trim(),
				accountType: newAccountType,
				workspaceId: workspaceApi.workspaceId,
			} as any, {
				onSuccess: () => {
					refetch();
					setIsCreateDialogOpen(false);
					setNewAccountName("");
					setNewAccountType("current_account");
				},
			});
		}
	};

	const handleEditAccount = (account: {
		id: string;
		name: string;
		accountType?: string;
	}) => {
		setEditingAccount({
			id: account.id,
			name: account.name,
			accountType: account.accountType || "current_account",
		});
		setIsEditDialogOpen(true);
	};

	const handleUpdateAccount = () => {
		if (editingAccount?.name.trim() && workspaceApi.workspaceId) {
			updateAccount.mutate({
				id: editingAccount.id,
				name: editingAccount.name.trim(),
				accountType: editingAccount.accountType as
					| "current_account"
					| "credit_card",
				workspaceId: workspaceApi.workspaceId,
			} as any, {
				onSuccess: () => {
					refetch();
					setIsEditDialogOpen(false);
					setEditingAccount(null);
				},
			});
		}
	};

	const handleDeleteAccount = (id: string) => {
		if (workspaceApi.workspaceId) {
			deleteAccount.mutate({ 
				id, 
				workspaceId: workspaceApi.workspaceId 
			} as any, {
				onSuccess: () => {
					refetch();
				},
			});
		}
	};

	if (isLoading) {
		return (
			<DashboardLayout title="Accounts" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-muted-foreground">Loading accounts...</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout title="Accounts" showAddButton={false}>
			<div className="space-y-6">
				{/* Header Section */}
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h1 className="font-bold text-2xl">Current Accounts</h1>
						<p className="text-muted-foreground">
							Manage your bank accounts and financial institutions.
						</p>
					</div>
					<Dialog
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}
					>
						<DialogTrigger asChild>
							<Button className="gap-2">
								<PlusIcon className="h-4 w-4" />
								Add Account
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Account</DialogTitle>
								<DialogDescription>
									Add a new bank account or financial institution.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label htmlFor="accountName">Account Name</Label>
									<Input
										id="accountName"
										placeholder="e.g., Santander Current Account, Barclays Savings"
										value={newAccountName}
										onChange={(e) => setNewAccountName(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" && handleCreateAccount()
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="accountType">Account Type</Label>
									<Select
										value={newAccountType}
										onValueChange={(value: "current_account" | "credit_card") =>
											setNewAccountType(value)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select account type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="current_account">
												Current Account
											</SelectItem>
											<SelectItem value="credit_card">Credit Card</SelectItem>
										</SelectContent>
									</Select>
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
									onClick={handleCreateAccount}
									disabled={!newAccountName.trim() || createAccount.isPending}
								>
									{createAccount.isPending ? "Creating..." : "Create Account"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				{/* Stats Cards */}
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Total Accounts
							</CardTitle>
							<CreditCardIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{accounts?.length ?? 0}</div>
							<p className="text-muted-foreground text-xs">Active accounts</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Current Accounts
							</CardTitle>
							<BuildingIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{accounts?.filter(
									(acc) => acc.accountType === "current_account",
								).length ?? 0}
							</div>
							<p className="text-muted-foreground text-xs">
								Bank current accounts
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Credit Cards
							</CardTitle>
							<CreditCardIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{accounts?.filter((acc) => acc.accountType === "credit_card")
									.length ?? 0}
							</div>
							<p className="text-muted-foreground text-xs">
								Credit card accounts
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
								Add New Account
							</Button>
						</CardContent>
					</Card>
				</div>

				{/* Accounts Table */}
				<Card>
					<CardHeader>
						<CardTitle>Accounts</CardTitle>
						<CardDescription>
							View and manage all your bank accounts.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{accounts && accounts.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Updated</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{accounts.map((account) => (
										<TableRow key={account.id}>
											<TableCell className="font-medium">
												<div className="flex items-center gap-2">
													<Badge
														variant="outline"
														className="cursor-pointer hover:bg-muted"
														onClick={() =>
															router.push(`/accounts/${account.id}`)
														}
													>
														<BuildingIcon className="mr-1 h-3 w-3" />
														{account.name}
													</Badge>
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant={
														account.accountType === "credit_card"
															? "destructive"
															: "default"
													}
												>
													{account.accountType === "credit_card"
														? "Credit Card"
														: "Current Account"}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{account.createdAt
													? new Date(account.createdAt).toLocaleDateString()
													: "Unknown"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{account.updatedAt
													? new Date(account.updatedAt).toLocaleDateString()
													: "Never"}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															router.push(`/accounts/${account.id}`)
														}
													>
														<EyeIcon className="h-4 w-4" />
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleEditAccount(account)}
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
																	Delete Account
																</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete "
																	{account.name}"? This action cannot be undone
																	and will affect any related expenses and
																	balances.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() =>
																		handleDeleteAccount(account.id)
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
								<CreditCardIcon className="mx-auto h-12 w-12 text-muted-foreground" />
								<h3 className="mt-4 font-semibold text-lg">No accounts yet</h3>
								<p className="mb-4 text-muted-foreground">
									Get started by adding your first account.
								</p>
								<Button onClick={() => setIsCreateDialogOpen(true)}>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Your First Account
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Edit Dialog */}
				<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit Account</DialogTitle>
							<DialogDescription>
								Update the name of this bank account.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="editAccountName">Account Name</Label>
								<Input
									id="editAccountName"
									placeholder="e.g., Santander Current Account, Barclays Savings"
									value={editingAccount?.name ?? ""}
									onChange={(e) =>
										setEditingAccount((prev) =>
											prev ? { ...prev, name: e.target.value } : null,
										)
									}
									onKeyDown={(e) => e.key === "Enter" && handleUpdateAccount()}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="editAccountType">Account Type</Label>
								<Select
									value={editingAccount?.accountType ?? "current_account"}
									onValueChange={(value: "current_account" | "credit_card") =>
										setEditingAccount((prev) =>
											prev ? { ...prev, accountType: value } : null,
										)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select account type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="current_account">
											Current Account
										</SelectItem>
										<SelectItem value="credit_card">Credit Card</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsEditDialogOpen(false);
									setEditingAccount(null);
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleUpdateAccount}
								disabled={
									!editingAccount?.name.trim() || updateAccount.isPending
								}
							>
								{updateAccount.isPending ? "Updating..." : "Update Account"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</DashboardLayout>
	);
}
