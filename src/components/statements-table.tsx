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
import { Button } from "grandeo/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "grandeo/components/ui/table";
import { EditStatementDialog } from "grandeo/components/edit-statement-dialog";
import { api } from "grandeo/trpc/react";
import {
	CalendarIcon,
	DownloadIcon,
	EditIcon,
	FileTextIcon,
	ScanIcon,
	TrashIcon,
	UploadIcon,
} from "lucide-react";
import { useState } from "react";

interface Statement {
	id: string;
	periodEndDate: Date | null;
	periodStartDate: Date | null;
	openingBalance: number | null;
	closingBalance: number | null;
	transactionCount: number | null;
	sourceFileName: string;
}

interface StatementsTableProps {
	statements: Statement[] | undefined;
	onUploadClick: () => void;
	onRefreshStatements: () => void;
	onRefreshTransactions: () => void;
}

export function StatementsTable({
	statements,
	onUploadClick,
	onRefreshStatements,
	onRefreshTransactions,
}: StatementsTableProps) {
	// State for edit dialog
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [selectedStatement, setSelectedStatement] = useState<Statement | null>(
		null,
	);

	// Mutations
	const deleteStatement = api.statements.delete.useMutation({
		onSuccess: () => {
			onRefreshStatements();
		},
	});

	const updateStatement = api.statements.update.useMutation({
		onSuccess: () => {
			onRefreshStatements();
			setEditDialogOpen(false);
			setSelectedStatement(null);
		},
		onError: (error) => {
			console.error("Update failed:", error);
		},
	});

	const downloadStatement = api.statements.download.useMutation({
		onSuccess: (result) => {
			if (result) {
				// Create blob from base64 data
				const binaryString = atob(result.fileData);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}

				const blob = new Blob([bytes], { type: result.contentType });

				// Create download link
				const url = window.URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = result.fileName;

				// Trigger download
				document.body.appendChild(link);
				link.click();

				// Cleanup
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			}
		},
		onError: (error) => {
			console.error("Download failed:", error);
		},
	});

	const parseStatement = api.statements.parseStatement.useMutation({
		onSuccess: () => {
			onRefreshStatements();
			onRefreshTransactions();
		},
		onError: (error) => {
			console.error("Parse failed:", error);
		},
	});

	const handleDownloadStatement = (statementId: string) => {
		downloadStatement.mutate({ id: statementId });
	};

	const handleParseStatement = (statementId: string) => {
		parseStatement.mutate({ id: statementId });
	};

	const handleDeleteStatement = (id: string) => {
		deleteStatement.mutate({ id });
	};

	const handleEditStatement = (statement: Statement) => {
		setSelectedStatement(statement);
		setEditDialogOpen(true);
	};

	const handleUpdateStatement = (data: {
		id: string;
		periodStartDate: Date | null;
		periodEndDate: Date | null;
		openingBalance: number | null;
		closingBalance: number | null;
	}) => {
		updateStatement.mutate(data);
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

	if (!statements || statements.length === 0) {
		return (
			<div className="py-12 text-center">
				<FileTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
				<h3 className="mt-4 font-semibold text-lg">No statements uploaded</h3>
				<p className="mb-4 text-muted-foreground">
					Upload your first statement to get started.
				</p>
				<Button onClick={onUploadClick}>
					<UploadIcon className="mr-2 h-4 w-4" />
					Upload Statement
				</Button>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Period End Date</TableHead>
						<TableHead>Period</TableHead>
						<TableHead>Opening Balance</TableHead>
						<TableHead>Closing Balance</TableHead>
						<TableHead>Transactions Imported</TableHead>
						<TableHead>File</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{statements.map((statement) => (
						<TableRow key={statement.id}>
							<TableCell className="font-medium">
								<div className="flex items-center gap-2">
									<CalendarIcon className="h-4 w-4 text-muted-foreground" />
									{statement.periodEndDate
										? formatDate(statement.periodEndDate)
										: "Not parsed"}
								</div>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{statement.periodStartDate && statement.periodEndDate
									? `${formatDate(statement.periodStartDate)} - ${formatDate(statement.periodEndDate)}`
									: "Not parsed"}
							</TableCell>
							<TableCell>
								{statement.openingBalance !== null ? (
									<span
										className={
											statement.openingBalance >= 0
												? "text-green-600"
												: "text-red-600"
										}
									>
										{formatCurrency(statement.openingBalance)}
									</span>
								) : (
									<span className="text-muted-foreground">Not parsed</span>
								)}
							</TableCell>
							<TableCell>
								{statement.closingBalance !== null ? (
									<span
										className={
											statement.closingBalance >= 0
												? "text-green-600"
												: "text-red-600"
										}
									>
										{formatCurrency(statement.closingBalance)}
									</span>
								) : (
									<span className="text-muted-foreground">Not parsed</span>
								)}
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{statement.transactionCount || 0}
									</span>
									<span className="text-muted-foreground text-xs">
										transactions
									</span>
								</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<FileTextIcon className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm">{statement.sourceFileName}</span>
								</div>
							</TableCell>
							<TableCell className="text-right">
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleEditStatement(statement)}
									>
										<EditIcon className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleDownloadStatement(statement.id)}
										disabled={downloadStatement.isPending}
									>
										<DownloadIcon className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleParseStatement(statement.id)}
										disabled={parseStatement.isPending}
									>
										<ScanIcon className="h-4 w-4" />
									</Button>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button variant="destructive" size="sm">
												<TrashIcon className="h-4 w-4" />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Delete Statement</AlertDialogTitle>
												<AlertDialogDescription>
													Are you sure you want to delete this statement
													{statement.periodEndDate
														? ` from ${formatDate(statement.periodEndDate)}`
														: ""}
													? This action cannot be undone.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => handleDeleteStatement(statement.id)}
												>
													Delete
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<EditStatementDialog
				statement={selectedStatement}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSave={handleUpdateStatement}
				isLoading={updateStatement.isPending}
			/>
		</>
	);
}
