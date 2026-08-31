"use client";

import { StagedTransactionRow } from "grandeo/components/staged-transaction-row";
import { Button } from "grandeo/components/ui/button";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { Loader2, PlusIcon, PoundSterlingIcon } from "lucide-react";
import { toast } from "sonner";

interface StagedTransaction {
	id: string;
	date: Date | string | null;
	description: string | null;
	amountInPounds: number;
	included: boolean;
	expenseCategoryId: string | null;
	duplicateOfTransactionId: string | null;
}

interface StagedTransactionsTableProps {
	batchId: string;
	stagedTransactions: StagedTransaction[];
	onChange: () => void;
}

export function StagedTransactionsTable({
	batchId,
	stagedTransactions,
	onChange,
}: StagedTransactionsTableProps) {
	const workspaceApi = useWorkspaceApi();

	const addStagedTransaction =
		workspaceApi.statementImports.addStagedTransaction();

	const handleAddStagedTransaction = () => {
		addStagedTransaction.mutate(
			{
				batchId,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: () => {
					onChange();
				},
				onError: (error) => {
					toast.error(error.message || "Failed to add transaction");
				},
			},
		);
	};

	const addButton = (
		<Button
			variant="outline"
			onClick={handleAddStagedTransaction}
			disabled={addStagedTransaction.isPending}
		>
			{addStagedTransaction.isPending ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<PlusIcon className="mr-2 h-4 w-4" />
			)}
			Add Transaction
		</Button>
	);

	if (stagedTransactions.length === 0) {
		return (
			<div className="py-12 text-center">
				<PoundSterlingIcon className="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 className="mt-4 font-semibold text-lg">
					No transactions were extracted
				</h3>
				<p className="mb-4 text-muted-foreground">
					Add the transactions manually, or discard this import and try again.
				</p>
				{addButton}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-16">Import</TableHead>
						<TableHead>Date</TableHead>
						<TableHead>Description</TableHead>
						<TableHead>Amount</TableHead>
						<TableHead>Expense Category</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{stagedTransactions.map((stagedTransaction) => (
						<StagedTransactionRow
							key={stagedTransaction.id}
							stagedTransaction={stagedTransaction}
							onChange={onChange}
						/>
					))}
				</TableBody>
			</Table>
			<div className="flex justify-start">{addButton}</div>
		</div>
	);
}
