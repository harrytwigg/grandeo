"use client";

import { DashboardLayout } from "grandeo/components/dashboard-layout";
import { EditStatementDialog } from "grandeo/components/edit-statement-dialog";
import { StagedTransactionsTable } from "grandeo/components/staged-transactions-table";
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
import { Button } from "grandeo/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	CheckIcon,
	EditIcon,
	FileTextIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function StatementImportReviewPage() {
	const router = useRouter();
	const params = useParams<{ id: string; statementId: string }>();
	const workspaceApi = useWorkspaceApi();
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const accountHref = `/accounts/${params.id}`;

	const {
		data: pendingImport,
		isLoading,
		refetch: refetchPendingImport,
	} = workspaceApi.statementImports.getPendingByStatementId(params.statementId);

	// Mutations
	const updateBatch = workspaceApi.statementImports.updateBatch();

	const approveBatch = workspaceApi.statementImports.approveBatch();

	const discardBatch = workspaceApi.statementImports.discardBatch();

	const handleUpdateBatch = (data: {
		id: string;
		periodStartDate: Date | null;
		periodEndDate: Date | null;
		openingBalance: number | null;
		closingBalance: number | null;
	}) => {
		updateBatch.mutate(
			{
				...data,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: () => {
					refetchPendingImport();
					setEditDialogOpen(false);
				},
				onError: (error) => {
					toast.error(error.message || "Failed to update statement details");
				},
			},
		);
	};

	const handleApproveBatch = (batchId: string) => {
		approveBatch.mutate(
			{
				id: batchId,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: (result) => {
					toast.success(
						`Imported ${result.importedCount} transaction${
							result.importedCount === 1 ? "" : "s"
						}`,
					);
					router.push(accountHref);
				},
				onError: (error) => {
					toast.error(error.message || "Failed to approve import");
				},
			},
		);
	};

	const handleDiscardBatch = (batchId: string) => {
		discardBatch.mutate(
			{
				id: batchId,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: () => {
					toast.success("Import discarded, nothing was added to your ledger");
					router.push(accountHref);
				},
				onError: (error) => {
					toast.error(error.message || "Failed to discard import");
				},
			},
		);
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

	if (isLoading) {
		return (
			<DashboardLayout title="Review Import" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-muted-foreground">Loading import...</div>
				</div>
			</DashboardLayout>
		);
	}

	if (!pendingImport) {
		return (
			<DashboardLayout title="Review Import" showAddButton={false}>
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<h3 className="mt-4 font-semibold text-lg">
							Nothing to review here
						</h3>
						<p className="mb-4 text-muted-foreground">
							This statement has no import waiting for review. It may already
							have been approved or discarded.
						</p>
						<Button onClick={() => router.push(accountHref)}>
							<ArrowLeftIcon className="mr-2 h-4 w-4" />
							Back to Account
						</Button>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	const { batch, stagedTransactions } = pendingImport;

	const includedTransactions = stagedTransactions.filter(
		(stagedTransaction) => stagedTransaction.included,
	);
	const skippedCount = stagedTransactions.length - includedTransactions.length;
	const duplicateCount = stagedTransactions.filter(
		(stagedTransaction) => stagedTransaction.duplicateOfTransactionId !== null,
	).length;
	const undatedCount = includedTransactions.filter(
		(stagedTransaction) => stagedTransaction.date === null,
	).length;
	const netTotal = includedTransactions.reduce(
		(total, stagedTransaction) => total + stagedTransaction.amountInPounds,
		0,
	);

	return (
		<DashboardLayout title="Review Import" showAddButton={false}>
			<div className="space-y-6">
				{/* Back Navigation */}
				<div className="flex items-center justify-between gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => router.push(accountHref)}
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Back to Account
					</Button>
					<div className="flex items-center gap-2">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" disabled={discardBatch.isPending}>
									Discard Import
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Discard Import</AlertDialogTitle>
									<AlertDialogDescription>
										Are you sure you want to discard all{" "}
										{stagedTransactions.length} extracted transactions? Nothing
										will be added to your ledger and the statement file is kept,
										so you can parse it again.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => handleDiscardBatch(batch.id)}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										Discard
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
						<Button
							onClick={() => handleApproveBatch(batch.id)}
							disabled={approveBatch.isPending || undatedCount > 0}
						>
							<CheckIcon className="mr-2 h-4 w-4" />
							{approveBatch.isPending
								? "Importing..."
								: `Approve & Import ${includedTransactions.length}`}
						</Button>
					</div>
				</div>

				{/* Import Summary */}
				<div className="grid gap-4 md:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">To Import</CardTitle>
							<CheckIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{includedTransactions.length}
							</div>
							<p className="text-muted-foreground text-xs">
								{skippedCount} of {stagedTransactions.length} extracted rows
								skipped
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Net Total</CardTitle>
						</CardHeader>
						<CardContent>
							<div
								className={`font-bold text-2xl ${
									netTotal === 0
										? "text-muted-foreground"
										: netTotal > 0
											? "text-green-600"
											: "text-red-600"
								}`}
							>
								{formatCurrency(netTotal)}
							</div>
							<p className="text-muted-foreground text-xs">
								Sum of the transactions that will be imported
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Source Statement
							</CardTitle>
							<FileTextIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="truncate font-medium text-sm">
								{batch.sourceFileName}
							</div>
							<p className="text-muted-foreground text-xs">
								Parsed{" "}
								{batch.createdAt ? formatDate(batch.createdAt) : "recently"}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Warnings */}
				{(duplicateCount > 0 || undatedCount > 0) && (
					<div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
						{duplicateCount > 0 && (
							<div className="flex items-center gap-2 text-sm">
								<AlertTriangleIcon className="h-4 w-4 text-amber-600" />
								{duplicateCount} row
								{duplicateCount === 1 ? " looks" : "s look"} like transactions
								already in this account and{" "}
								{duplicateCount === 1 ? "has" : "have"} been unticked. Tick{" "}
								{duplicateCount === 1 ? "it" : "them"} to import anyway.
							</div>
						)}
						{undatedCount > 0 && (
							<div className="flex items-center gap-2 text-sm">
								<AlertTriangleIcon className="h-4 w-4 text-amber-600" />
								{undatedCount} row{undatedCount === 1 ? " has" : "s have"} no
								date. Set a date or untick the row before importing.
							</div>
						)}
					</div>
				)}

				{/* Statement Details */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Statement Details</CardTitle>
								<CardDescription>
									These values are applied to the statement when you approve the
									import.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEditDialogOpen(true)}
							>
								<EditIcon className="mr-2 h-4 w-4" />
								Edit
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-4">
							<div>
								<div className="text-muted-foreground text-xs">
									Period Start
								</div>
								<div className="font-medium text-sm">
									{batch.periodStartDate
										? formatDate(batch.periodStartDate)
										: "Not parsed"}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground text-xs">Period End</div>
								<div className="font-medium text-sm">
									{batch.periodEndDate
										? formatDate(batch.periodEndDate)
										: "Not parsed"}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground text-xs">
									Opening Balance
								</div>
								<div className="font-medium text-sm">
									{batch.openingBalance !== null
										? formatCurrency(batch.openingBalance)
										: "Not parsed"}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground text-xs">
									Closing Balance
								</div>
								<div className="font-medium text-sm">
									{batch.closingBalance !== null
										? formatCurrency(batch.closingBalance)
										: "Not parsed"}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Extracted Transactions */}
				<Card>
					<CardHeader>
						<CardTitle>Extracted Transactions</CardTitle>
						<CardDescription>
							Check every row before importing. Edit anything the parser got
							wrong, untick rows you do not want, and add anything it missed.
							Nothing reaches your transactions until you approve.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<StagedTransactionsTable
							batchId={batch.id}
							stagedTransactions={stagedTransactions}
							onChange={refetchPendingImport}
						/>
					</CardContent>
				</Card>
			</div>

			<EditStatementDialog
				statement={{
					id: batch.id,
					periodStartDate: batch.periodStartDate,
					periodEndDate: batch.periodEndDate,
					openingBalance: batch.openingBalance,
					closingBalance: batch.closingBalance,
					transactionCount: stagedTransactions.length,
					sourceFileName: batch.sourceFileName,
				}}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSave={handleUpdateBatch}
				isLoading={updateBatch.isPending}
				title="Edit Statement Details"
				description="These period dates and balances are applied to the statement when you approve the import."
			/>
		</DashboardLayout>
	);
}
