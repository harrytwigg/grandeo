"use client";

import { AccountBalanceChart } from "grandeo/components/account-balance-chart";
import { DashboardLayout } from "grandeo/components/dashboard-layout";
import { ManualSplitDialog } from "grandeo/components/manual-split-dialog";
import { StatementsTable } from "grandeo/components/statements-table";
import { TransactionsTable } from "grandeo/components/transactions-table";
import { TransactionSplitsTable } from "grandeo/components/transaction-splits-table";
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
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "grandeo/components/ui/tabs";
import { api } from "grandeo/trpc/react";
import {
	ArrowLeftIcon,
	PlusIcon,
	PoundSterlingIcon,
	UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AccountDetailPageProps {
	params: {
		id: string;
	};
}

export default function AccountDetailPage({ params }: AccountDetailPageProps) {
	const router = useRouter();
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
	const [newStatementFile, setNewStatementFile] = useState<File | null>(null);
	const [isManualSplitDialogOpen, setIsManualSplitDialogOpen] = useState(false);

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

	// Get owed balance for this account (splits to other accounts)
	const {
		data: owedBalance,
		isLoading: isLoadingOwedBalance,
		refetch: refetchOwedBalance,
	} = api.transactions.getOwedBalanceByAccountId.useQuery({
		accountId: params.id,
	});

	// Mutations
	const createStatement = api.statements.create.useMutation({
		onSuccess: () => {
			refetchStatements();
			setIsUploadDialogOpen(false);
			setNewStatementFile(null);
		},
	});

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

	if (isLoadingAccount || isLoadingStatements || isLoadingOwedBalance) {
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
				<div className="grid gap-4 md:grid-cols-3">
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
										? "Other accounts owe this money"
										: "This account owes money to others"}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Tabs for different sections */}
				<Tabs defaultValue="statements" className="w-full">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="statements">Statements</TabsTrigger>
						<TabsTrigger value="transactions">Transactions</TabsTrigger>
						<TabsTrigger value="splits">Transaction Splits</TabsTrigger>
						<TabsTrigger value="balances">Balance History</TabsTrigger>
					</TabsList>

					<TabsContent value="statements" className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Bank Statements</CardTitle>
										<CardDescription>
											View and manage uploaded bank statements for this account.
											If overlapping statement ranges are detected, transactions
											will not be imported to avoid duplicates.
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
								<StatementsTable
									statements={statements}
									onUploadClick={() => setIsUploadDialogOpen(true)}
									onRefreshStatements={refetchStatements}
									onRefreshTransactions={() => {}}
								/>
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
								<TransactionsTable
									accountId={params.id}
									onRefreshOwedBalance={refetchOwedBalance}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="splits" className="space-y-4">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Transaction Splits</CardTitle>
										<CardDescription>
											View all transaction splits involving this account with
											other accounts.
										</CardDescription>
									</div>
									<Button onClick={() => setIsManualSplitDialogOpen(true)}>
										<PlusIcon className="mr-2 h-4 w-4" />
										Add Manual Split
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<TransactionSplitsTable accountId={params.id} />
							</CardContent>
						</Card>

						<ManualSplitDialog
							open={isManualSplitDialogOpen}
							onOpenChange={setIsManualSplitDialogOpen}
							currentAccountId={params.id}
						/>
					</TabsContent>

					<TabsContent value="balances" className="space-y-4">
						<AccountBalanceChart
							accountId={params.id}
							accountName={currentAccount.name}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</DashboardLayout>
	);
}
