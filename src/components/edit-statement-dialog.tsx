"use client";

import { Button } from "grandeo/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "grandeo/components/ui/dialog";
import { Input } from "grandeo/components/ui/input";
import { Label } from "grandeo/components/ui/label";
import { useEffect, useState } from "react";

interface Statement {
	id: string;
	periodEndDate: Date | null;
	periodStartDate: Date | null;
	openingBalance: number | null;
	closingBalance: number | null;
	transactionCount: number | null;
	sourceFileName: string;
}

interface EditStatementDialogProps {
	statement: Statement | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: {
		id: string;
		periodStartDate: Date | null;
		periodEndDate: Date | null;
		openingBalance: number | null;
		closingBalance: number | null;
	}) => void;
	isLoading?: boolean;
}

export function EditStatementDialog({
	statement,
	open,
	onOpenChange,
	onSave,
	isLoading = false,
}: EditStatementDialogProps) {
	const [formData, setFormData] = useState({
		periodStartDate: "",
		periodEndDate: "",
		openingBalance: "",
		closingBalance: "",
	});

	// Reset form when statement changes or dialog opens
	useEffect(() => {
		// Format date for input (YYYY-MM-DD)
		const formatDateForInput = (date: Date | null) => {
			if (!date) return "";
			const d = new Date(date);
			return d.toISOString().split("T")[0];
		};

		if (statement && open) {
			setFormData({
				periodStartDate: formatDateForInput(statement.periodStartDate) || "",
				periodEndDate: formatDateForInput(statement.periodEndDate) || "",
				openingBalance: statement.openingBalance?.toString() ?? "",
				closingBalance: statement.closingBalance?.toString() ?? "",
			});
		}
	}, [statement, open]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!statement) return;

		const parsedData = {
			id: statement.id,
			periodStartDate: formData.periodStartDate
				? new Date(formData.periodStartDate)
				: null,
			periodEndDate: formData.periodEndDate
				? new Date(formData.periodEndDate)
				: null,
			openingBalance: formData.openingBalance
				? Number.parseFloat(formData.openingBalance)
				: null,
			closingBalance: formData.closingBalance
				? Number.parseFloat(formData.closingBalance)
				: null,
		};

		onSave(parsedData);
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit Statement</DialogTitle>
					<DialogDescription>
						Update the period dates and balance information for this statement.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="periodStartDate" className="text-right">
								Start Date
							</Label>
							<Input
								id="periodStartDate"
								type="date"
								value={formData.periodStartDate}
								onChange={(e) =>
									handleInputChange("periodStartDate", e.target.value)
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="periodEndDate" className="text-right">
								End Date
							</Label>
							<Input
								id="periodEndDate"
								type="date"
								value={formData.periodEndDate}
								onChange={(e) =>
									handleInputChange("periodEndDate", e.target.value)
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="openingBalance" className="text-right">
								Opening Balance
							</Label>
							<Input
								id="openingBalance"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.openingBalance}
								onChange={(e) =>
									handleInputChange("openingBalance", e.target.value)
								}
								className="col-span-3"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="closingBalance" className="text-right">
								Closing Balance
							</Label>
							<Input
								id="closingBalance"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.closingBalance}
								onChange={(e) =>
									handleInputChange("closingBalance", e.target.value)
								}
								className="col-span-3"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
