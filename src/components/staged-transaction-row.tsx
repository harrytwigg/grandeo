"use client";

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
import { Checkbox } from "grandeo/components/ui/checkbox";
import { Input } from "grandeo/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import { TableCell, TableRow } from "grandeo/components/ui/table";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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

interface StagedTransactionRowProps {
	stagedTransaction: StagedTransaction;
	onChange: () => void;
}

// Format a date for a native date input (YYYY-MM-DD). Built from local date parts
// rather than toISOString(), which would shift the day for anyone west of UTC or
// on British Summer Time - the parser stores dates at local midnight.
const formatDateForInput = (date: Date | string | null) => {
	if (!date) return "";
	const dateObj = typeof date === "string" ? new Date(date) : date;
	const month = `${dateObj.getMonth() + 1}`.padStart(2, "0");
	const day = `${dateObj.getDate()}`.padStart(2, "0");
	return `${dateObj.getFullYear()}-${month}-${day}`;
};

// Parse a YYYY-MM-DD input value back to local midnight, matching how parsed
// statement dates are constructed
const parseDateFromInput = (value: string) => {
	if (!value) return null;
	const [year, month, day] = value.split("-").map(Number);
	if (
		typeof year !== "number" ||
		typeof month !== "number" ||
		typeof day !== "number"
	) {
		return null;
	}
	return new Date(year, month - 1, day);
};

export function StagedTransactionRow({
	stagedTransaction,
	onChange,
}: StagedTransactionRowProps) {
	const workspaceApi = useWorkspaceApi();

	// Get all expense categories for the dropdown
	const { data: expenseCategories } = workspaceApi.expenseCategories.getAll();

	const serverDate = formatDateForInput(stagedTransaction.date);
	const serverDescription = stagedTransaction.description ?? "";
	const serverAmountInPounds = stagedTransaction.amountInPounds.toString();
	const serverExpenseCategoryId =
		stagedTransaction.expenseCategoryId ?? "uncategorized";

	const [formData, setFormData] = useState({
		date: serverDate,
		description: serverDescription,
		amountInPounds: serverAmountInPounds,
		expenseCategoryId: serverExpenseCategoryId,
	});

	// Re-sync only when the stored values actually change, so a refetch triggered by
	// another row does not throw away edits typed into this one
	useEffect(() => {
		setFormData({
			date: serverDate,
			description: serverDescription,
			amountInPounds: serverAmountInPounds,
			expenseCategoryId: serverExpenseCategoryId,
		});
	}, [
		serverDate,
		serverDescription,
		serverAmountInPounds,
		serverExpenseCategoryId,
	]);

	// Mutations
	const updateStagedTransaction =
		workspaceApi.statementImports.updateStagedTransaction();

	const setStagedTransactionIncluded =
		workspaceApi.statementImports.setStagedTransactionIncluded();

	const deleteStagedTransaction =
		workspaceApi.statementImports.deleteStagedTransaction();

	const isDirty =
		formData.date !== serverDate ||
		formData.description !== serverDescription ||
		formData.amountInPounds !== serverAmountInPounds ||
		formData.expenseCategoryId !== serverExpenseCategoryId;

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleSave = () => {
		const amountInPounds = Number.parseFloat(formData.amountInPounds);

		if (Number.isNaN(amountInPounds)) {
			toast.error("Amount must be a number");
			return;
		}

		updateStagedTransaction.mutate(
			{
				id: stagedTransaction.id,
				workspaceId: workspaceApi.workspaceId ?? "",
				date: parseDateFromInput(formData.date),
				description: formData.description || null,
				amountInPounds,
				expenseCategoryId:
					formData.expenseCategoryId === "uncategorized"
						? null
						: formData.expenseCategoryId,
			},
			{
				onSuccess: () => {
					onChange();
				},
				onError: (error) => {
					toast.error(error.message || "Failed to save transaction");
				},
			},
		);
	};

	const handleIncludedChange = (checked: boolean) => {
		setStagedTransactionIncluded.mutate(
			{
				id: stagedTransaction.id,
				workspaceId: workspaceApi.workspaceId ?? "",
				included: checked,
			},
			{
				onSuccess: () => {
					onChange();
				},
				onError: (error) => {
					toast.error(error.message || "Failed to update transaction");
				},
			},
		);
	};

	const handleDelete = () => {
		deleteStagedTransaction.mutate(
			{
				id: stagedTransaction.id,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: () => {
					onChange();
				},
				onError: (error) => {
					toast.error(error.message || "Failed to delete transaction");
				},
			},
		);
	};

	return (
		<TableRow className={stagedTransaction.included ? "" : "opacity-60"}>
			<TableCell>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={stagedTransaction.included}
						onCheckedChange={handleIncludedChange}
						disabled={setStagedTransactionIncluded.isPending}
						aria-label="Import this transaction"
					/>
					{setStagedTransactionIncluded.isPending && (
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>
			</TableCell>
			<TableCell>
				<Input
					type="date"
					value={formData.date}
					onChange={(e) => handleInputChange("date", e.target.value)}
					className="w-40"
				/>
			</TableCell>
			<TableCell>
				<div className="flex flex-col gap-1">
					<Input
						value={formData.description}
						placeholder="No description"
						onChange={(e) => handleInputChange("description", e.target.value)}
						className="min-w-56"
					/>
					{stagedTransaction.duplicateOfTransactionId && (
						<Badge variant="secondary" className="w-fit">
							Possible duplicate
						</Badge>
					)}
				</div>
			</TableCell>
			<TableCell>
				<Input
					type="number"
					step="0.01"
					value={formData.amountInPounds}
					onChange={(e) => handleInputChange("amountInPounds", e.target.value)}
					className="w-32"
				/>
			</TableCell>
			<TableCell>
				<Select
					value={formData.expenseCategoryId}
					onValueChange={(value) =>
						handleInputChange("expenseCategoryId", value)
					}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Select category" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="uncategorized">Uncategorized</SelectItem>
						{expenseCategories?.map((category) => (
							<SelectItem key={category.id} value={category.id}>
								{category.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell>
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleSave}
						disabled={!isDirty || updateStagedTransaction.isPending}
					>
						{updateStagedTransaction.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save"
						)}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
								disabled={deleteStagedTransaction.isPending}
							>
								{deleteStagedTransaction.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Trash2 className="h-4 w-4" />
								)}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Remove Transaction</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to remove this row from the import? It
									has not been imported yet, so nothing in your ledger changes.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleDelete}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									Remove
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</TableCell>
		</TableRow>
	);
}
