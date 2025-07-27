import { Button } from "grandeo/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "grandeo/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { PoundSterlingIcon } from "lucide-react";
import { useState } from "react";
import { TransactionRow } from "./transaction-row";

interface TransactionsTableProps {
	accountId: string;
	onRefreshOwedBalance?: () => void;
}

export function TransactionsTable({
	accountId,
	onRefreshOwedBalance,
}: TransactionsTableProps) {
	const workspaceApi = useWorkspaceApi();
	const [currentPage, setCurrentPage] = useState(1);
	const [handledFilter, setHandledFilter] = useState<
		"all" | "handled" | "unhandled"
	>("all");
	const pageSize = 20;

	const {
		data: transactionsData,
		isLoading,
		refetch: refetchTransactions,
	} = api.transactions.getByAccountId.useQuery({
		accountId,
		page: currentPage,
		pageSize,
		handled: handledFilter,
	});

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handleFilterChange = (filter: "all" | "handled" | "unhandled") => {
		setHandledFilter(filter);
		setCurrentPage(1); // Reset to first page when filter changes
	};

	const utils = api.useUtils();

	const handleRefreshTransactions = () => {
		refetchTransactions();
		onRefreshOwedBalance?.();
		utils.transactions.getSplitsByAccountId.invalidate({ accountId });
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-muted-foreground">Loading transactions...</div>
			</div>
		);
	}

	if (
		!transactionsData?.transactions ||
		transactionsData.transactions.length === 0
	) {
		return (
			<div className="py-12 text-center">
				<PoundSterlingIcon className="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 className="mt-4 font-semibold text-lg">No transactions found</h3>
				<p className="mb-4 text-muted-foreground">
					Upload and parse a statement to see transactions here.
				</p>
			</div>
		);
	}

	const { transactions, pagination } = transactionsData;

	// Generate pagination items
	const generatePaginationItems = () => {
		const items = [];
		const totalPages = pagination.totalPages;
		const currentPage = pagination.page;

		// Always show first page
		items.push(
			<PaginationItem key={1}>
				<PaginationLink
					href="#"
					onClick={(e) => {
						e.preventDefault();
						handlePageChange(1);
					}}
					isActive={currentPage === 1}
				>
					1
				</PaginationLink>
			</PaginationItem>,
		);

		if (totalPages <= 7) {
			// Show all pages if 7 or fewer
			for (let i = 2; i <= totalPages; i++) {
				items.push(
					<PaginationItem key={i}>
						<PaginationLink
							href="#"
							onClick={(e) => {
								e.preventDefault();
								handlePageChange(i);
							}}
							isActive={currentPage === i}
						>
							{i}
						</PaginationLink>
					</PaginationItem>,
				);
			}
		} else {
			// Show ellipsis and relevant pages
			if (currentPage > 3) {
				items.push(
					<PaginationItem key="ellipsis1">
						<PaginationEllipsis />
					</PaginationItem>,
				);
			}

			// Show pages around current page
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			for (let i = start; i <= end; i++) {
				items.push(
					<PaginationItem key={i}>
						<PaginationLink
							href="#"
							onClick={(e) => {
								e.preventDefault();
								handlePageChange(i);
							}}
							isActive={currentPage === i}
						>
							{i}
						</PaginationLink>
					</PaginationItem>,
				);
			}

			if (currentPage < totalPages - 2) {
				items.push(
					<PaginationItem key="ellipsis2">
						<PaginationEllipsis />
					</PaginationItem>,
				);
			}

			// Always show last page if more than 1 page
			if (totalPages > 1) {
				items.push(
					<PaginationItem key={totalPages}>
						<PaginationLink
							href="#"
							onClick={(e) => {
								e.preventDefault();
								handlePageChange(totalPages);
							}}
							isActive={currentPage === totalPages}
						>
							{totalPages}
						</PaginationLink>
					</PaginationItem>,
				);
			}
		}

		return items;
	};

	return (
		<div className="space-y-4">
			{/* Filter Bar */}
			<div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm">Filter by status:</span>
					<Select
						value={handledFilter}
						onValueChange={(value: "all" | "handled" | "unhandled") =>
							handleFilterChange(value)
						}
					>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Transactions</SelectItem>
							<SelectItem value="handled">Handled Only</SelectItem>
							<SelectItem value="unhandled">Unhandled Only</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{transactionsData?.pagination && (
					<div className="text-muted-foreground text-sm">
						Showing {transactionsData.pagination.total} transaction
						{transactionsData.pagination.total !== 1 ? "s" : ""}
					</div>
				)}
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Date</TableHead>
						<TableHead>Description</TableHead>
						<TableHead>Expense Category</TableHead>
						<TableHead>Amount</TableHead>
						<TableHead>Handled</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{transactions.map((transaction) => (
						<TransactionRow
							key={transaction.id}
							transaction={transaction}
							onCategoryChange={handleRefreshTransactions}
							onHandledChange={handleRefreshTransactions}
							onSplitsChange={handleRefreshTransactions}
						/>
					))}
				</TableBody>
			</Table>

			{/* Pagination */}
			{pagination.totalPages > 1 && (
				<div className="flex items-center justify-between">
					<div className="text-muted-foreground text-sm">
						Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
						{Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
						of {pagination.total} transactions
					</div>
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									href="#"
									onClick={(e) => {
										e.preventDefault();
										if (pagination.hasPrev) {
											handlePageChange(pagination.page - 1);
										}
									}}
									className={
										!pagination.hasPrev ? "pointer-events-none opacity-50" : ""
									}
								/>
							</PaginationItem>
							{generatePaginationItems()}
							<PaginationItem>
								<PaginationNext
									href="#"
									onClick={(e) => {
										e.preventDefault();
										if (pagination.hasNext) {
											handlePageChange(pagination.page + 1);
										}
									}}
									className={
										!pagination.hasNext ? "pointer-events-none opacity-50" : ""
									}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			)}
		</div>
	);
}
