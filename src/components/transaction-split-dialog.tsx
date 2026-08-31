import { Button } from "grandeo/components/ui/button";
import { Checkbox } from "grandeo/components/ui/checkbox";
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
import { ArrowLeftRight, Plus, Split, Trash2 } from "lucide-react";
import React, { useState } from "react";

/**
 * Ratios are relative weights, not percentages, so they do not need to sum to
 * 100 - they get normalised when applied. Asymmetric ratios are listed in both
 * directions so the share can be pointed at either account in one click.
 */
const SPLIT_PRESET_GROUPS: {
	group: string;
	presets: { label: string; ratios: number[] }[];
}[] = [
	{
		group: "2-way",
		presets: [
			{ label: "50 / 50", ratios: [50, 50] },
			{ label: "42 / 58", ratios: [42, 58] },
			{ label: "58 / 42", ratios: [58, 42] },
			{ label: "⅓ / ⅔", ratios: [1, 2] },
			{ label: "⅔ / ⅓", ratios: [2, 1] },
			{ label: "40 / 60", ratios: [40, 60] },
			{ label: "60 / 40", ratios: [60, 40] },
			{ label: "30 / 70", ratios: [30, 70] },
			{ label: "70 / 30", ratios: [70, 30] },
			{ label: "25 / 75", ratios: [25, 75] },
			{ label: "75 / 25", ratios: [75, 25] },
			{ label: "20 / 80", ratios: [20, 80] },
			{ label: "80 / 20", ratios: [80, 20] },
			{ label: "10 / 90", ratios: [10, 90] },
			{ label: "90 / 10", ratios: [90, 10] },
		],
	},
	{
		group: "3-way",
		presets: [
			{ label: "⅓ / ⅓ / ⅓", ratios: [1, 1, 1] },
			{ label: "50 / 25 / 25", ratios: [50, 25, 25] },
			{ label: "25 / 50 / 25", ratios: [25, 50, 25] },
			{ label: "25 / 25 / 50", ratios: [25, 25, 50] },
			{ label: "40 / 40 / 20", ratios: [40, 40, 20] },
			{ label: "20 / 40 / 40", ratios: [20, 40, 40] },
		],
	},
];

const roundToPence = (amount: number) => Math.round(amount * 100) / 100;

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
		handled?: boolean;
	};
	onSplitsCreated?: () => void;
}

export function TransactionSplitDialog({
	transaction,
	onSplitsCreated,
}: TransactionSplitDialogProps) {
	const [open, setOpen] = useState(false);
	// Splitting a transaction is usually the last thing you do with it, so
	// default to clearing it off the unhandled list once the splits land.
	const [markAsResolved, setMarkAsResolved] = useState(true);
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
	const { data: existingSplits, refetch: refetchSplits } =
		workspaceApi.transactions.getSplitsByTransactionId(transaction.id);

	// Mutations
	const createSplits = workspaceApi.transactions.createSplits();

	const deleteAllSplits = workspaceApi.transactions.deleteAllSplits();

	const updateHandled = workspaceApi.transactions.updateHandled();

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

	const applyRatio = (ratios: number[]) => {
		const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
		if (totalRatio <= 0) return;

		// Grow the rows if the preset needs more splits than we currently have.
		const nextSplits: TransactionSplit[] = [...splits];
		while (nextSplits.length < ratios.length) {
			nextSplits.push({
				currentAccountId: "",
				amountInPounds: 0,
				description: "",
			});
		}

		let allocated = 0;
		const updatedSplits = nextSplits.map((split, index) => {
			const ratio = ratios[index] ?? 0;
			const isLast = index === nextSplits.length - 1;
			// The last row absorbs the rounding remainder so the totals always
			// reconcile to the original amount down to the penny.
			const amountInPounds = isLast
				? roundToPence(transaction.amountInPounds - allocated)
				: roundToPence((transaction.amountInPounds * ratio) / totalRatio);

			allocated += amountInPounds;
			return { ...split, amountInPounds };
		});

		setSplits(updatedSplits);
	};

	const splitEqually = () => {
		applyRatio(splits.map(() => 1));
	};

	const reverseAmounts = () => {
		const amounts = splits.map((split) => split.amountInPounds);

		setSplits(
			splits.map((split, index) => ({
				...split,
				amountInPounds:
					amounts[splits.length - 1 - index] ?? split.amountInPounds,
			})),
		);
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
					if (!markAsResolved) {
						setOpen(false);
						refetchSplits();
						onSplitsCreated?.();
						return;
					}

					// The splits are already saved at this point, so a failure to
					// mark the transaction resolved must not look like a failed
					// split - close up either way and let the refetch show the
					// real state.
					updateHandled.mutate(
						{
							id: transaction.id,
							handled: true,
							workspaceId: workspaceApi.workspaceId ?? "",
						},
						{
							onSettled: () => {
								setOpen(false);
								refetchSplits();
								onSplitsCreated?.();
							},
						},
					);
				},
			},
		);
	};

	const handleDeleteAllSplits = () => {
		deleteAllSplits.mutate(
			{
				transactionId: transaction.id,
				workspaceId: workspaceApi.workspaceId ?? "",
			},
			{
				onSuccess: () => {
					refetchSplits();
					onSplitsCreated?.();
				},
			},
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
			setMarkAsResolved(!transaction.handled);
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
						One of the splits can be this account if you want to keep a share of
						the transaction yourself. Use a quick split preset to set the ratio,
						then pick an account for each row.
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
									<Button
										variant="outline"
										size="sm"
										onClick={reverseAmounts}
										disabled={splits.length < 2}
									>
										<ArrowLeftRight className="mr-1 h-4 w-4" />
										Reverse
									</Button>
									<Button variant="outline" size="sm" onClick={addSplit}>
										<Plus className="mr-1 h-4 w-4" />
										Add Split
									</Button>
								</div>
							</div>

							{/* Quick ratio presets - add any rows the preset needs */}
							<div className="space-y-3">
								{SPLIT_PRESET_GROUPS.map(({ group, presets }) => (
									<div key={group} className="space-y-2">
										<Label className="text-muted-foreground text-xs">
											Quick splits ({group})
										</Label>
										<div className="flex flex-wrap gap-2">
											{presets.map((preset) => (
												<Button
													key={preset.label}
													variant="secondary"
													size="sm"
													onClick={() => applyRatio(preset.ratios)}
												>
													{preset.label}
												</Button>
											))}
										</div>
									</div>
								))}
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
							<div className="space-y-3 pt-4">
								<div className="flex items-center gap-2">
									<Checkbox
										id="mark-as-resolved"
										checked={markAsResolved}
										onCheckedChange={(checked) =>
											setMarkAsResolved(checked === true)
										}
									/>
									<Label
										htmlFor="mark-as-resolved"
										className="font-normal text-sm"
									>
										Mark transaction as resolved
									</Label>
								</div>
								<div className="flex gap-2">
									<Button
										onClick={handleCreateSplits}
										disabled={
											!isValidSplit() ||
											createSplits.isPending ||
											updateHandled.isPending
										}
										className="flex-1"
									>
										{createSplits.isPending || updateHandled.isPending
											? "Creating..."
											: markAsResolved
												? "Create Splits & Mark Resolved"
												: "Create Splits"}
									</Button>
									<Button variant="outline" onClick={() => setOpen(false)}>
										Cancel
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
