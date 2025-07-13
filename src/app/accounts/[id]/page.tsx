"use client";

import { useRouter } from "next/navigation";
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
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "grandeo/components/ui/tabs";
import {
	ArrowLeftIcon,
	FileTextIcon,
	PlusIcon,
	TrashIcon,
	DownloadIcon,
	CalendarIcon,
	PoundSterlingIcon,
	UploadIcon,
	ScanIcon,
} from "lucide-react";
import { api } from "grandeo/trpc/react";
import { TransactionRow } from "grandeo/components/transaction-row";

interface AccountDetailPageProps {
	params: {
		id: string;
	};
}

export default function AccountDetailPage({ params }: AccountDetailPageProps) {
	const router = useRouter();
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
	const [newStatementFile, setNewStatementFile] = useState<File | null>(null);

	// TRPC queries
	const {
		data: account,
		isLoading: isLoadingAccount,
		refetch: refetchAccount,
	} = api.currentAccounts.getById.useQuery({ id: params.id });

	const {
		data: statements,
		isLoading: isLoadingStatements,
		refetch: refetchStatements,
	} = api.statements.getByAccountId.useQuery({ accountId: params.id });

	const {
		data: transactions,
		isLoading: isLoadingTransactions,
		refetch: refetchTransactions,
	} = api.transactions.getByAccountId.useQuery({ accountId: params.id });

	// Get owed balance for this account (splits to other accounts)
	const {
		data: owedBalance,
		isLoading: isLoadingOwedBalance,
		refetch: refetchOwedBalance,
	} = api.transactions.getOwedBalanceByAccountId.useQuery({
		accountId: params.id,
	});

	// Mutations
	const deleteStatement = api.statements.delete.useMutation({
		onSuccess: () => {
			refetchStatements();
		},
	});

	const createStatement = api.statements.create.useMutation({
		onSuccess: () => {
			refetchStatements();
			refetchTransactions();
			setIsUploadDialogOpen(false);
			setNewStatementFile(null);
		},
	});

	const downloadStatement = api.statements.download.useMutation({
		onSuccess: (result) => {
			if (result) {
				// Create blob from base64 data
				const binaryString = atob(result.fileData);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}

				const blob = new Blob([bytes], { type: result.contentType });

				// Create download link
				const url = window.URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = result.fileName;

				// Trigger download
				document.body.appendChild(link);
				link.click();

				// Cleanup
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			}
		},
		onError: (error) => {
			console.error("Download failed:", error);
		},
	});

	const parseStatement = api.statements.parseStatement.useMutation({
		onSuccess: () => {
			refetchStatements();
			refetchTransactions();
		},
		onError: (error) => {
			console.error("Parse failed:", error);
		},
	});

	const handleDownloadStatement = (statementId: string) => {
		downloadStatement.mutate({ id: statementId });
	};

	const handleParseStatement = (statementId: string) => {
		parseStatement.mutate({ id: statementId });
	};

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			setNewStatementFile(file);
		}
	};

	const handleUploadStatement = () => {
		if (newStatementFile) {
			const reader = new FileReader();
			reader.onload = () => {
				if (reader.result && typeof reader.result === "string") {
					// Extract base64 string (remove data:mime;base64, prefix)
					const base64String = reader.result.split(",")[1];
					if (base64String) {
						createStatement.mutate({
							currentAccountId: params.id,
							fileBase64: base64String,
							fileName: newStatementFile.name,
						});
					}
				}
			};
			reader.readAsDataURL(newStatementFile);
		}
	};

	const handleDeleteStatement = (id: string) => {
		deleteStatement.mutate({ id });
	};

	const formatCurrency = (amount: number) => {
		if (amount === 0) {
			return "£0.00";
		}

		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
		}).format(amount);
	};

	const formatDate = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	};

	if (
		isLoadingAccount ||
		isLoadingStatements ||
		isLoadingTransactions ||
		isLoadingOwedBalance
	) {
		return (
			<DashboardLayout title="Account Details" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-muted-foreground">
						Loading account details...
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (!account) {
		return (
			<DashboardLayout title="Account Details" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<h3 className="mt-4 font-semibold text-lg">Account not found</h3>
						<p className="mb-4 text-muted-foreground">
							The account you're looking for doesn't exist.
						</p>
						<Button onClick={() => router.push("/accounts")}>
							<ArrowLeftIcon className="mr-2 h-4 w-4" />
							Back to Accounts
						</Button>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	const currentAccount = account;
	const totalTransactions = transactions?.length || 0;
	const latestStatement = statements?.[0];
	const currentBalance = latestStatement?.closingBalance ?? null;

	return (
		<DashboardLayout title={currentAccount.name} showAddButton={false}>
			<div className="space-y-6">
				{/* Back Navigation */}
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => router.push("/accounts")}
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Back to Accounts
					</Button>
				</div>

				{/* Account Overview */}
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Account Type
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Badge
								variant={
									currentAccount.accountType === "credit_card"
										? "destructive"
										: "default"
								}
							>
								{currentAccount.accountType === "credit_card"
									? "Credit Card"
									: "Current Account"}
							</Badge>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Current Balance
							</CardTitle>
							<PoundSterlingIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{currentBalance !== null
									? formatCurrency(currentBalance)
									: "N/A"}
							</div>
							<p className="text-muted-foreground text-xs">
								{latestStatement?.periodEndDate
									? `As of ${formatDate(latestStatement.periodEndDate)}`
									: "No statements uploaded"}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Transactions
							</CardTitle>
							<PoundSterlingIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{totalTransactions}</div>
							<p className="text-muted-foreground text-xs">
								Total transactions
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Owed Balance
							</CardTitle>
							<PoundSterlingIcon
								className={`h-4 w-4 ${(owedBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
							/>
						</CardHeader>
						<CardContent>
							<div
								className={`font-bold text-2xl ${
									owedBalance === 0
										? "text-muted-foreground"
										: (owedBalance ?? 0) > 0
											? "text-green-600"
											: "text-red-600"
								}`}
							>
								{owedBalance !== null && owedBalance !== undefined
									? formatCurrency(owedBalance)
									: formatCurrency(0)}
							</div>
							<p className="text-muted-foreground text-xs">
								{owedBalance === 0
									? "No money is owed between accounts"
									: (owedBalance ?? 0) > 0
										? "Other accounts owe this account money"
										: "This account owes money to other accounts"}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Tabs for different sections */}
				<Tabs defaultValue="statements" className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="statements">Statements</TabsTrigger>
						<TabsTrigger value="transactions">Transactions</TabsTrigger>
						<TabsTrigger value="balances" disabled>
							Balance History
						</TabsTrigger>
					</TabsList>

					<TabsContent value="statements" className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Bank Statements</CardTitle>
										<CardDescription>
											View and manage uploaded bank statements for this account.
										</CardDescription>
									</div>
									<Dialog
										open={isUploadDialogOpen}
										onOpenChange={setIsUploadDialogOpen}
									>
										<DialogTrigger asChild>
											<Button className="gap-2">
												<UploadIcon className="h-4 w-4" />
												Upload Statement
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Upload Bank Statement</DialogTitle>
												<DialogDescription>
													Upload a new bank statement file for{" "}
													{currentAccount.name}.
												</DialogDescription>
											</DialogHeader>
											<div className="space-y-4 py-4">
												<div className="space-y-2">
													<Label htmlFor="statementFile">Statement File</Label>
													<Input
														id="statementFile"
														type="file"
														accept=".pdf,.csv,.txt"
														onChange={handleFileUpload}
													/>
													<p className="text-muted-foreground text-sm">
														Supported formats: PDF, CSV, TXT
													</p>
												</div>
												{newStatementFile && (
													<div className="rounded-md border p-3">
														<p className="font-medium text-sm">
															Selected file:
														</p>
														<p className="text-muted-foreground text-sm">
															{newStatementFile.name} (
															{Math.round(newStatementFile.size / 1024)} KB)
														</p>
													</div>
												)}
											</div>
											<DialogFooter>
												<Button
													variant="outline"
													onClick={() => {
														setIsUploadDialogOpen(false);
														setNewStatementFile(null);
													}}
												>
													Cancel
												</Button>
												<Button
													onClick={handleUploadStatement}
													disabled={
														!newStatementFile || createStatement.isPending
													}
												>
													{createStatement.isPending
														? "Uploading..."
														: "Upload Statement"}
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							</CardHeader>
							<CardContent>
								{statements && statements.length > 0 ? (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Period End Date</TableHead>
												<TableHead>Period</TableHead>
												<TableHead>Opening Balance</TableHead>
												<TableHead>Closing Balance</TableHead>
												<TableHead>Transactions</TableHead>
												<TableHead>File</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{statements.map((statement) => (
												<TableRow key={statement.id}>
													<TableCell className="font-medium">
														<div className="flex items-center gap-2">
															<CalendarIcon className="h-4 w-4 text-muted-foreground" />
															{statement.periodEndDate
																? formatDate(statement.periodEndDate)
																: "Not parsed"}
														</div>
													</TableCell>
													<TableCell className="text-muted-foreground">
														{statement.periodStartDate &&
														statement.periodEndDate
															? `${formatDate(statement.periodStartDate)} - ${formatDate(statement.periodEndDate)}`
															: "Not parsed"}
													</TableCell>
													<TableCell>
														{statement.openingBalance !== null ? (
															<span
																className={
																	statement.openingBalance >= 0
																		? "text-green-600"
																		: "text-red-600"
																}
															>
																{formatCurrency(statement.openingBalance)}
															</span>
														) : (
															<span className="text-muted-foreground">
																Not parsed
															</span>
														)}
													</TableCell>
													<TableCell>
														{statement.closingBalance !== null ? (
															<span
																className={
																	statement.closingBalance >= 0
																		? "text-green-600"
																		: "text-red-600"
																}
															>
																{formatCurrency(statement.closingBalance)}
															</span>
														) : (
															<span className="text-muted-foreground">
																Not parsed
															</span>
														)}
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<span className="font-medium text-sm">
																{statement.transactionCount || 0}
															</span>
															<span className="text-muted-foreground text-xs">
																transactions
															</span>
														</div>
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<FileTextIcon className="h-4 w-4 text-muted-foreground" />
															<span className="text-sm">
																{statement.sourceFileName}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleDownloadStatement(statement.id)
																}
																disabled={downloadStatement.isPending}
															>
																<DownloadIcon className="h-4 w-4" />
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleParseStatement(statement.id)
																}
																disabled={parseStatement.isPending}
															>
																<ScanIcon className="h-4 w-4" />
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
																			Delete Statement
																		</AlertDialogTitle>
																		<AlertDialogDescription>
																			Are you sure you want to delete this
																			statement
																			{statement.periodEndDate
																				? ` from ${formatDate(statement.periodEndDate)}`
																				: ""}
																			? This action cannot be undone.
																		</AlertDialogDescription>
																	</AlertDialogHeader>
																	<AlertDialogFooter>
																		<AlertDialogCancel>
																			Cancel
																		</AlertDialogCancel>
																		<AlertDialogAction
																			onClick={() =>
																				handleDeleteStatement(statement.id)
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
										<FileTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
										<h3 className="mt-4 font-semibold text-lg">
											No statements uploaded
										</h3>
										<p className="mb-4 text-muted-foreground">
											Upload your first statement to get started.
										</p>
										<Button onClick={() => setIsUploadDialogOpen(true)}>
											<UploadIcon className="mr-2 h-4 w-4" />
											Upload Statement
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="transactions" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Transactions</CardTitle>
								<CardDescription>
									View all transactions for this account.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{transactions && transactions.length > 0 ? (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Description</TableHead>
												<TableHead>Expense Category</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Handled</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{transactions.map((transaction) => (
												<TransactionRow
													key={transaction.id}
													transaction={transaction}
													onCategoryChange={() => {
														// Refetch transactions when category changes
														refetchTransactions();
													}}
													onHandledChange={() => {
														// Refetch transactions when handled status changes
														refetchTransactions();
													}}
													onSplitsChange={() => {
														// Refetch transactions and owed balance when splits are created/deleted
														refetchTransactions();
														refetchOwedBalance();
													}}
												/>
											))}
										</TableBody>
									</Table>
								) : (
									<div className="py-12 text-center">
										<PoundSterlingIcon className="mx-auto h-12 w-12 text-muted-foreground" />
										<h3 className="mt-4 font-semibold text-lg">
											No transactions found
										</h3>
										<p className="mb-4 text-muted-foreground">
											Upload and parse a statement to see transactions here.
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="balances" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Balance History</CardTitle>
								<CardDescription>
									Historical balance tracking will be available here in the
									future.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="py-12 text-center">
									{" "}
									<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
										<CalendarIcon className="h-6 w-6 text-muted-foreground" />
									</div>
									<h3 className="mt-4 font-semibold text-lg">Coming Soon</h3>
									<p className="text-muted-foreground">
										Balance history tracking features will be added here.
									</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</DashboardLayout>
	);
}
