import { Button } from "grandeo/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Textarea } from "grandeo/components/ui/textarea";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { Plus, Split, Trash2 } from "lucide-react";
import React, { useState } from "react";

interface TransactionSplit {
	id?: string;
	currentAccountId: string;
	amountInPounds: number;
	description?: string;
}

interface TransactionSplitDialogProps {
	transaction: {
		id: string;
		amountInPounds: number;
		description: string | null;
		currentAccountId: string;
	};
	onSplitsCreated?: () => void;
}

export function TransactionSplitDialog({
	transaction,
	onSplitsCreated,
}: TransactionSplitDialogProps) {
	const [open, setOpen] = useState(false);
	const [splits, setSplits] = useState<TransactionSplit[]>([
		{
			currentAccountId: transaction.currentAccountId,
			amountInPounds: transaction.amountInPounds,
			description: transaction.description || "",
		},
	]);

	const workspaceApi = useWorkspaceApi();

	// Get all current accounts for the dropdown
	const { data: currentAccounts } = workspaceApi.currentAccounts.getAll();

	// Get existing splits for this transaction
	const { 
		data: existingSplits, 
		refetch: refetchSplits 
	} = workspaceApi.transactions.getSplitsByTransactionId(transaction.id);

	// Mutations
	const createSplits = workspaceApi.transactions.createSplits();

	const deleteAllSplits = workspaceApi.transactions.deleteAllSplits();

	const addSplit = () => {
		setSplits([
			...splits,
			{
				currentAccountId: "",
				amountInPounds: 0,
				description: "",
			},
		]);
	};

	const splitEqually = () => {
		const numberOfSplits = splits.length;
		const amountPerSplit = transaction.amountInPounds / numberOfSplits;

		const updatedSplits = splits.map((split) => ({
			...split,
			amountInPounds: amountPerSplit,
		}));

		setSplits(updatedSplits);
	};

	const addEqualSplit = () => {
		const currentSplitsCount = splits.length;
		const newSplitsCount = currentSplitsCount + 1;
		const amountPerSplit = transaction.amountInPounds / newSplitsCount;

		// Update existing splits to equal amounts
		const updatedExistingSplits = splits.map((split) => ({
			...split,
			amountInPounds: amountPerSplit,
		}));

		// Add new split with equal amount
		const newSplit = {
			currentAccountId: "",
			amountInPounds: amountPerSplit,
			description: "",
		};

		setSplits([...updatedExistingSplits, newSplit]);
	};

	const applyPercentageSplit = (percentages: number[]) => {
		if (percentages.length !== splits.length) return;

		const updatedSplits = splits.map((split, index) => {
			const percentage = percentages[index];
			if (percentage === undefined) return split;

			return {
				...split,
				amountInPounds: (transaction.amountInPounds * percentage) / 100,
			};
		});

		setSplits(updatedSplits);
	};

	const removeSplit = (index: number) => {
		if (splits.length > 1) {
			setSplits(splits.filter((_, i) => i !== index));
		}
	};

	const updateSplit = (
		index: number,
		field: keyof TransactionSplit,
		value: string | number,
	) => {
		const newSplits = [...splits];
		const currentSplit = newSplits[index];

		if (!currentSplit) return;

		if (field === "currentAccountId" && typeof value === "string") {
			newSplits[index] = { ...currentSplit, currentAccountId: value };
		} else if (field === "amountInPounds" && typeof value === "number") {
			newSplits[index] = { ...currentSplit, amountInPounds: value };
		} else if (field === "description" && typeof value === "string") {
			newSplits[index] = { ...currentSplit, description: value };
		}
		setSplits(newSplits);
	};

	const getTotalAmount = () => {
		return splits.reduce((sum, split) => sum + (split.amountInPounds || 0), 0);
	};

	const getRemainingAmount = () => {
		return transaction.amountInPounds - getTotalAmount();
	};

	const getPercentage = (amount: number) => {
		if (transaction.amountInPounds === 0) return 0;
		return (amount / Math.abs(transaction.amountInPounds)) * 100;
	};

	const isValidSplit = () => {
		const totalAmount = getTotalAmount();
		const hasAllAccounts = splits.every((split) => split.currentAccountId);
		const amountMatches =
			Math.abs(totalAmount - transaction.amountInPounds) < 0.01;

		return hasAllAccounts && amountMatches && splits.length > 0;
	};

	const handleCreateSplits = () => {
		if (!isValidSplit()) return;

		createSplits.mutate(
			{
				sourceTransactionId: transaction.id,
				workspaceId: workspaceApi.workspaceId ?? "",
				splits: splits.map((split) => ({
					currentAccountId: split.currentAccountId,
					amountInPounds: split.amountInPounds,
					description: split.description || null,
				})),
			},
			{
				onSuccess: () => {
					setOpen(false);
					refetchSplits();
					onSplitsCreated?.();
				},
			}
		);
	};

	const handleDeleteAllSplits = () => {
		deleteAllSplits.mutate(
			{ 
				transactionId: transaction.id,
				workspaceId: workspaceApi.workspaceId ?? ""
			},
			{
				onSuccess: () => {
					refetchSplits();
					onSplitsCreated?.();
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

	const hasExistingSplits = existingSplits && existingSplits.length > 0;

	// Reset splits when dialog opens
	React.useEffect(() => {
		if (open) {
			setSplits([
				{
					currentAccountId: transaction.currentAccountId,
					amountInPounds: transaction.amountInPounds,
					description: transaction.description || "",
				},
			]);
		}
	}, [open, transaction]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Split className="mr-1 h-4 w-4" />
					Split
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Split Transaction</DialogTitle>
					<DialogDescription>
						Split this transaction across multiple accounts. Total splits must
						equal {formatCurrency(transaction.amountInPounds)}.
					</DialogDescription>
					<DialogDescription>
						One of the splits can be this account if you want to split 50% of
						the transaction with another account.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Show existing splits if any */}
					{existingSplits && existingSplits.length > 0 && (
						<div className="rounded-lg border bg-muted/50 p-4">
							<div className="mb-3 flex items-center justify-between">
								<h3 className="font-medium">Existing Splits</h3>
								<Button
									variant="destructive"
									size="sm"
									onClick={handleDeleteAllSplits}
									disabled={deleteAllSplits.isPending}
								>
									<Trash2 className="mr-1 h-4 w-4" />
									Delete All
								</Button>
							</div>
							<div className="space-y-2">
								{existingSplits.map((split) => (
									<div
										key={split.id}
										className="flex items-center justify-between text-sm"
									>
										<span>
											{split.currentAccount?.name || "Unknown Account"}
										</span>
										<span className="font-medium">
											{formatCurrency(split.amountInPounds)}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Split creation form */}
					{hasExistingSplits ? (
						<div className="rounded-lg border bg-yellow-50 p-4">
							<div className="flex items-center gap-2 text-yellow-800">
								<span className="font-medium text-sm">
									⚠️ Transaction already has splits
								</span>
							</div>
							<p className="mt-2 text-sm text-yellow-700">
								This transaction already has existing splits. To create new
								splits, you must first delete the existing splits using the
								"Delete All" button above.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<Label className="font-medium text-base">
									Create New Splits
								</Label>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={splitEqually}
										disabled={splits.length === 0}
									>
										Split Equally
									</Button>
									<Button variant="outline" size="sm" onClick={addSplit}>
										<Plus className="mr-1 h-4 w-4" />
										Add Split
									</Button>
								</div>
							</div>

							{splits.map((split, index) => (
								<div
									key={`split-${index}-${split.currentAccountId}`}
									className="space-y-3 rounded-lg border p-4"
								>
									<div className="flex items-center justify-between">
										<Label className="font-medium text-sm">
											Split {index + 1}
										</Label>
										{splits.length > 1 && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => removeSplit(index)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-1">
											<Label htmlFor={`account-${index}`} className="text-xs">
												Account
											</Label>
											<Select
												value={split.currentAccountId}
												onValueChange={(value) =>
													updateSplit(index, "currentAccountId", value)
												}
											>
												<SelectTrigger id={`account-${index}`}>
													<SelectValue placeholder="Select account" />
												</SelectTrigger>
												<SelectContent>
													{currentAccounts?.map((account) => (
														<SelectItem key={account.id} value={account.id}>
															{account.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1">
											<Label htmlFor={`amount-${index}`} className="text-xs">
												Amount (£)
											</Label>
											<div className="space-y-1">
												<Input
													id={`amount-${index}`}
													type="number"
													step="0.01"
													value={split.amountInPounds || ""}
													onChange={(e) =>
														updateSplit(
															index,
															"amountInPounds",
															Number.parseFloat(e.target.value) || 0,
														)
													}
													placeholder="0.00"
												/>
												<div className="text-muted-foreground text-xs">
													{getPercentage(split.amountInPounds).toFixed(1)}% of
													total
												</div>
											</div>
										</div>
									</div>

									<div className="space-y-1">
										<Label htmlFor={`description-${index}`} className="text-xs">
											Description (optional)
										</Label>
										<Textarea
											id={`description-${index}`}
											value={split.description || ""}
											onChange={(e) =>
												updateSplit(index, "description", e.target.value)
											}
											placeholder="Optional description for this split"
											rows={2}
										/>
									</div>
								</div>
							))}

							{/* Summary */}
							<div className="rounded-lg border bg-muted/50 p-4">
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span>Original Amount:</span>
										<span className="font-medium">
											{formatCurrency(transaction.amountInPounds)}
										</span>
									</div>
									<div className="flex justify-between">
										<span>Total Splits:</span>
										<span className="font-medium">
											{formatCurrency(getTotalAmount())} (
											{getPercentage(getTotalAmount()).toFixed(1)}%)
										</span>
									</div>
									<div className="flex justify-between">
										<span>Remaining:</span>
										<span
											className={`font-medium ${
												Math.abs(getRemainingAmount()) < 0.01
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{formatCurrency(getRemainingAmount())}
										</span>
									</div>
									{Math.abs(getRemainingAmount()) < 0.01 && (
										<div className="mt-2 text-green-600 text-xs">
											✓ Splits total matches the original amount
										</div>
									)}
								</div>
							</div>

							{/* Action buttons */}
							<div className="flex gap-2 pt-4">
								<Button
									onClick={handleCreateSplits}
									disabled={!isValidSplit() || createSplits.isPending}
									className="flex-1"
								>
									{createSplits.isPending ? "Creating..." : "Create Splits"}
								</Button>
								<Button variant="outline" onClick={() => setOpen(false)}>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
