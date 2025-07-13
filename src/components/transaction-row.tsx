import { TableCell, TableRow } from "grandeo/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import { Checkbox } from "grandeo/components/ui/checkbox";
import { CalendarIcon, Loader2 } from "lucide-react";
import { api } from "grandeo/trpc/react";

interface Transaction {
	id: string;
	date: Date | string;
	description: string | null;
	amountInPounds: number;
	handled: boolean;
	expenseCategory?: {
		id: string;
		name: string;
	} | null;
}

interface TransactionRowProps {
	transaction: Transaction;
	onCategoryChange?: (transactionId: string, categoryId: string | null) => void;
	onHandledChange?: (transactionId: string, handled: boolean) => void;
}

export function TransactionRow({
	transaction,
	onCategoryChange,
	onHandledChange,
}: TransactionRowProps) {
	// Get all expense categories for the dropdown
	const { data: expenseCategories } = api.expenseCategories.getAll.useQuery();

	// Mutation for updating expense category
	const updateExpenseCategory =
		api.transactions.updateExpenseCategory.useMutation({
			onSuccess: (_, variables) => {
				// Call the callback with the updated category ID
				if (onCategoryChange) {
					onCategoryChange(transaction.id, variables.expenseCategoryId);
				}
			},
		});

	// Mutation for updating handled status
	const updateHandled = api.transactions.updateHandled.useMutation({
		onSuccess: (_, variables) => {
			// Call the callback with the updated handled status
			if (onHandledChange) {
				onHandledChange(transaction.id, variables.handled);
			}
		},
	});

	const handleCategoryChange = (categoryId: string) => {
		const newCategoryId = categoryId === "uncategorized" ? null : categoryId;
		updateExpenseCategory.mutate({
			id: transaction.id,
			expenseCategoryId: newCategoryId,
		});
	};

	const handleHandledChange = (checked: boolean) => {
		updateHandled.mutate({
			id: transaction.id,
			handled: checked,
		});
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

	return (
		<TableRow key={transaction.id}>
			<TableCell className="font-medium">
				<div className="flex items-center gap-2">
					<CalendarIcon className="h-4 w-4 text-muted-foreground" />
					{formatDate(transaction.date)}
				</div>
			</TableCell>
			<TableCell>
				<div className="max-w-md truncate">
					{transaction.description || "No description"}
				</div>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-2">
					<Select
						value={transaction.expenseCategory?.id || "uncategorized"}
						onValueChange={handleCategoryChange}
						disabled={updateExpenseCategory.isPending}
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
					{updateExpenseCategory.isPending && (
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>
			</TableCell>
			<TableCell className="text-right">
				<span
					className={
						transaction.amountInPounds >= 0
							? "font-medium text-green-600"
							: "font-medium text-red-600"
					}
				>
					{transaction.amountInPounds >= 0 ? "+" : ""}
					{formatCurrency(transaction.amountInPounds)}
				</span>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={transaction.handled}
						onCheckedChange={handleHandledChange}
						disabled={updateHandled.isPending}
					/>
					{updateHandled.isPending && (
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
