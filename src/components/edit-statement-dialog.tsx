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
	title?: string;
	description?: string;
}

export function EditStatementDialog({
	statement,
	open,
	onOpenChange,
	onSave,
	isLoading = false,
	title = "Edit Statement",
	description = "Update the period dates and balance information for this statement.",
}: EditStatementDialogProps) {
	const [formData, setFormData] = useState({
		periodStartDate: "",
		periodEndDate: "",
		openingBalance: "",
		closingBalance: "",
	});

	// Reset form when statement changes or dialog opens
	useEffect(() => {
		// Format date for input (YYYY-MM-DD), from local date parts so the day is not
		// shifted for anyone west of UTC or on British Summer Time
		const formatDateForInput = (date: Date | null) => {
			if (!date) return "";
			const d = new Date(date);
			const month = `${d.getMonth() + 1}`.padStart(2, "0");
			const day = `${d.getDate()}`.padStart(2, "0");
			return `${d.getFullYear()}-${month}-${day}`;
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
			periodStartDate: parseDateFromInput(formData.periodStartDate),
			periodEndDate: parseDateFromInput(formData.periodEndDate),
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
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
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
