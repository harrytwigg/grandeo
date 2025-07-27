import { Badge } from "grandeo/components/ui/badge";
import { Button } from "grandeo/components/ui/button";
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
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CalendarIcon,
	Trash2Icon,
} from "lucide-react";

interface TransactionSplitsTableProps {
	accountId: string;
}

export function TransactionSplitsTable({
	accountId,
}: TransactionSplitsTableProps) {
	const workspaceApi = useWorkspaceApi();
	
	const { 
		data: splits, 
		isLoading,
		refetch: refetchSplits
	} = workspaceApi.transactions.getSplitsByAccountId(accountId);

	const deleteSplitMutation = workspaceApi.transactions.deleteSplit();

	const handleDeleteSplit = (splitId: string) => {
		deleteSplitMutation.mutate(
			{ 
				splitId, 
				workspaceId: workspaceApi.workspaceId ?? "" 
			},
			{
				onSuccess: () => {
					// Refetch the splits data after successful deletion
					refetchSplits();
					// Note: For more complex invalidation, we'd need to pass refetch callbacks from parent
				},
			}
		);
	};

	const formatCurrency = (amount: number) => {
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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-muted-foreground">Loading splits...</div>
			</div>
		);
	}

	if (!splits || splits.length === 0) {
		return (
			<div className="py-12 text-center">
				<ArrowRightIcon className="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 className="mt-4 font-semibold text-lg">No transaction splits</h3>
				<p className="mb-4 text-muted-foreground">
					This account has no transaction splits with other accounts.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Date</TableHead>
						<TableHead>Transaction</TableHead>
						<TableHead>Split Direction</TableHead>
						<TableHead>Other Account</TableHead>
						<TableHead>Description</TableHead>
						<TableHead className="text-right">Amount</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{splits.map((split) => {
						const isIncoming = split.currentAccountId === accountId;
						const isManualSplit = !split.sourceTransactionId; // No source transaction means it's a manual split

						let otherAccountName: string;
						if (isManualSplit) {
							// For manual splits
							if (isIncoming) {
								// This account receives money, so the other account is the source
								otherAccountName =
									split.sourceAccount?.name || "Unknown Account";
							} else {
								// This account sends money, so the other account is the target
								otherAccountName =
									split.currentAccount?.name || "Unknown Account";
							}
						} else {
							// For transaction-based splits
							otherAccountName = isIncoming
								? "Source Account"
								: split.currentAccount?.name || "Unknown Account";
						}

						return (
							<TableRow key={split.id}>
								<TableCell className="font-medium">
									<div className="flex items-center gap-2">
										<CalendarIcon className="h-4 w-4 text-muted-foreground" />
										{isManualSplit
											? split.createdAt
												? formatDate(split.createdAt)
												: "Unknown"
											: split.sourceTransaction?.date
												? formatDate(split.sourceTransaction.date)
												: "Unknown"}
									</div>
								</TableCell>
								<TableCell>
									<div className="max-w-md">
										{isManualSplit ? (
											<>
												<div className="font-medium text-sm">Manual Split</div>
												<div className="text-muted-foreground text-xs">
													Standalone split not tied to a transaction
												</div>
											</>
										) : (
											<>
												<div className="font-medium text-sm">
													{split.sourceTransaction?.description ||
														"No description"}
												</div>
												<div className="text-muted-foreground text-xs">
													Original:{" "}
													{split.sourceTransaction?.amountInPounds
														? formatCurrency(
																split.sourceTransaction.amountInPounds,
															)
														: "N/A"}
												</div>
											</>
										)}
									</div>
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										{isIncoming ? (
											<>
												<ArrowLeftIcon className="h-4 w-4 text-green-600" />
												<Badge variant="secondary" className="text-green-600">
													Incoming
												</Badge>
											</>
										) : (
											<>
												<ArrowRightIcon className="h-4 w-4 text-blue-600" />
												<Badge variant="secondary" className="text-blue-600">
													Outgoing
												</Badge>
											</>
										)}
										{isManualSplit && (
											<Badge variant="outline" className="text-xs">
												Manual
											</Badge>
										)}
									</div>
								</TableCell>
								<TableCell>
									<div className="font-medium text-sm">{otherAccountName}</div>
									{(isManualSplit
										? split.sourceAccount || split.currentAccount
										: split.currentAccount
									)?.accountType && (
										<div className="text-muted-foreground text-xs">
											{(isManualSplit
												? split.sourceAccount || split.currentAccount
												: split.currentAccount
											)?.accountType === "credit_card"
												? "Credit Card"
												: "Current Account"}
										</div>
									)}
								</TableCell>
								<TableCell>
									<div className="max-w-md text-sm">
										{split.description || (
											<span className="text-muted-foreground italic">
												No description
											</span>
										)}
									</div>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex flex-col items-end gap-1">
										{(() => {
											if (isManualSplit) {
												// For manual splits, the logic is simpler
												const splitAmount = Math.abs(split.amountInPounds);
												let displayAmount: number;
												let explanationText: string;

												if (isIncoming) {
													// This account receives money
													displayAmount = splitAmount;
													explanationText = `Received ${formatCurrency(splitAmount)}`;
												} else {
													// This account sends money
													displayAmount = -splitAmount;
													explanationText = `Sent ${formatCurrency(splitAmount)}`;
												}

												return (
													<>
														<span
															className={`font-medium ${
																displayAmount >= 0
																	? "text-green-600"
																	: "text-red-600"
															}`}
														>
															{displayAmount >= 0 ? "+" : ""}
															{formatCurrency(displayAmount)}
														</span>
														<span className="text-muted-foreground text-xs">
															{explanationText}
														</span>
													</>
												);
											}

											// Original logic for transaction-based splits
											const originalAmount =
												split.sourceTransaction?.amountInPounds || 0;
											const splitAmount = Math.abs(split.amountInPounds);
											let displayAmount: number;
											let explanationText: string;

											if (isIncoming) {
												if (originalAmount >= 0) {
													displayAmount = splitAmount;
													explanationText = `Other account owes ${formatCurrency(splitAmount)}`;
												} else {
													displayAmount = -splitAmount;
													explanationText = `This account owes ${formatCurrency(splitAmount)}`;
												}
											} else {
												if (originalAmount >= 0) {
													displayAmount = -splitAmount;
													explanationText = `This account owes ${formatCurrency(splitAmount)}`;
												} else {
													displayAmount = splitAmount;
													explanationText = `Other account owes ${formatCurrency(splitAmount)}`;
												}
											}

											return (
												<>
													<span
														className={`font-medium ${
															displayAmount >= 0
																? "text-green-600"
																: "text-red-600"
														}`}
													>
														{displayAmount >= 0 ? "+" : ""}
														{formatCurrency(displayAmount)}
													</span>
													<span className="text-muted-foreground text-xs">
														{explanationText}
													</span>
												</>
											);
										})()}
									</div>
								</TableCell>
								<TableCell className="text-right">
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												disabled={deleteSplitMutation.isPending}
											>
												<Trash2Icon className="h-4 w-4" />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Delete Transaction Split
												</AlertDialogTitle>
												<AlertDialogDescription>
													Are you sure you want to delete this transaction
													split? This action cannot be undone.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => handleDeleteSplit(split.id)}
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												>
													Delete
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
