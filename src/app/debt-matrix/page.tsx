"use client";

import { DashboardLayout } from "grandeo/components/dashboard-layout";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { Badge } from "grandeo/components/ui/badge";
import { Skeleton } from "grandeo/components/ui/skeleton";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { CalculatorIcon } from "lucide-react";

export default function DebtMatrixPage() {
	const { workspaceId } = useWorkspaceApi();
	const { data: debtMatrix, isLoading } =
		useWorkspaceApi().transactions.getDebtMatrix.useQuery(
			{ workspaceId: workspaceId ?? "" },
			{ enabled: !!workspaceId },
		);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
		}).format(amount);
	};

	const getAmountColor = (amount: number) => {
		if (amount === 0) return "text-muted-foreground";
		if (amount > 0) return "text-red-600"; // Owes money
		return "text-green-600"; // Is owed money
	};

	const getAmountBadgeVariant = (amount: number) => {
		if (amount === 0) return "secondary";
		if (amount > 0) return "destructive"; // Owes money
		return "default"; // Is owed money
	};

	if (isLoading) {
		return (
			<DashboardLayout title="Debt Matrix" showAddButton={false}>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<CalculatorIcon className="h-5 w-5 text-primary" />
								<Skeleton className="h-6 w-48" />
							</div>
							<Skeleton className="h-4 w-96" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
							</div>
						</CardContent>
					</Card>
				</div>
			</DashboardLayout>
		);
	}

	if (!debtMatrix || debtMatrix.accounts.length === 0) {
		return (
			<DashboardLayout title="Debt Matrix" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<CalculatorIcon className="mx-auto h-12 w-12 text-muted-foreground" />
						<h3 className="mt-4 font-semibold text-lg">No accounts found</h3>
						<p className="mb-4 text-muted-foreground">
							Create some accounts first to see the debt matrix.
						</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout title="Debt Matrix" showAddButton={false}>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<CalculatorIcon className="h-5 w-5 text-primary" />
							<CardTitle>Account Debt Matrix</CardTitle>
						</div>
						<CardDescription>
							See how much each account owes to other accounts. Positive amounts
							indicate debt owed, negative amounts indicate money to be
							received.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-48">Account</TableHead>
										{debtMatrix.accounts.map((account) => (
											<TableHead
												key={account.id}
												className="min-w-32 text-center"
											>
												<div className="flex flex-col items-center gap-1">
													<span className="font-medium text-xs">
														{account.name}
													</span>
													<Badge
														variant={
															account.accountType === "credit_card"
																? "destructive"
																: "secondary"
														}
														className="text-xs"
													>
														{account.accountType === "credit_card"
															? "Credit"
															: "Current"}
													</Badge>
												</div>
											</TableHead>
										))}
										<TableHead className="text-center font-semibold">
											Total Owed
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{debtMatrix.matrix.map((row) => {
										const totalOwed = row.debts.reduce(
											(sum, debt) => sum + debt.amount,
											0,
										);

										return (
											<TableRow key={row.account.id}>
												<TableCell className="font-medium">
													<div className="flex items-center gap-2">
														<span>{row.account.name}</span>
														<Badge
															variant={
																row.account.accountType === "credit_card"
																	? "destructive"
																	: "secondary"
															}
															className="text-xs"
														>
															{row.account.accountType === "credit_card"
																? "Credit"
																: "Current"}
														</Badge>
													</div>
												</TableCell>
												{debtMatrix.accounts.map((account) => {
													if (account.id === row.account.id) {
														return (
															<TableCell
																key={account.id}
																className="text-center"
															>
																<span className="text-muted-foreground">-</span>
															</TableCell>
														);
													}

													const debt = row.debts.find(
														(d) => d.toAccount.id === account.id,
													);
													const amount = debt?.amount ?? 0;

													return (
														<TableCell key={account.id} className="text-center">
															{amount === 0 ? (
																<span className="text-muted-foreground">
																	£0.00
																</span>
															) : (
																<span className={getAmountColor(amount)}>
																	{amount > 0 ? "+" : ""}
																	{formatCurrency(amount)}
																</span>
															)}
														</TableCell>
													);
												})}
												<TableCell className="text-center font-semibold">
													{totalOwed === 0 ? (
														<span className="text-muted-foreground">£0.00</span>
													) : (
														<span className={getAmountColor(totalOwed)}>
															{totalOwed > 0 ? "+" : ""}
															{formatCurrency(totalOwed)}
														</span>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>

				{/* Summary Card */}
				<Card>
					<CardHeader>
						<CardTitle>Summary</CardTitle>
						<CardDescription>
							Quick overview of total debts across all accounts
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-3">
							<div className="text-center">
								<div className="font-bold text-2xl text-red-600">
									{formatCurrency(
										debtMatrix.matrix.reduce(
											(sum, row) =>
												sum +
												row.debts.reduce(
													(rowSum, debt) => rowSum + Math.max(0, debt.amount),
													0,
												),
											0,
										),
									)}
								</div>
								<p className="text-muted-foreground text-sm">
									Total Outstanding Debt
								</p>
							</div>
							<div className="text-center">
								<div className="font-bold text-2xl text-green-600">
									{formatCurrency(
										debtMatrix.matrix.reduce(
											(sum, row) =>
												sum +
												row.debts.reduce(
													(rowSum, debt) => rowSum + Math.max(0, -debt.amount),
													0,
												),
											0,
										),
									)}
								</div>
								<p className="text-muted-foreground text-sm">
									Total To Be Received
								</p>
							</div>
							<div className="text-center">
								<div className="font-bold text-2xl">
									{debtMatrix.accounts.length}
								</div>
								<p className="text-muted-foreground text-sm">Total Accounts</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}
