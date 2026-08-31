"use client";

import { api } from "grandeo/trpc/react";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

interface WorkspaceContextType {
	currentWorkspaceId: string | null;
	workspaces:
		| Array<{
				id: string;
				name: string;
				description: string | null;
				role: string;
				createdAt: Date | null;
		  }>
		| undefined;
	isLoading: boolean;
	switchWorkspace: (workspaceId: string) => void;
	refetchWorkspaces: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
	undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
		searchParams.get("workspace"),
	);

	const {
		data: workspaces,
		isLoading,
		refetch: refetchWorkspaces,
	} = api.workspaces.getAll.useQuery();

	// Auto-select first workspace if none selected and workspaces exist
	useEffect(() => {
		if (
			!isLoading &&
			workspaces &&
			workspaces.length > 0 &&
			!currentWorkspaceId
		) {
			const firstWorkspace = workspaces[0];
			if (firstWorkspace) {
				switchWorkspace(firstWorkspace.id);
			}
		}
	}, [workspaces, isLoading, currentWorkspaceId]);

	// Update current workspace when URL changes
	useEffect(() => {
		const workspaceFromUrl = searchParams.get("workspace");
		setCurrentWorkspaceId(workspaceFromUrl);
	}, [searchParams]);

	const switchWorkspace = (workspaceId: string) => {
		setCurrentWorkspaceId(workspaceId);
		const params = new URLSearchParams(searchParams);
		params.set("workspace", workspaceId);
		router.push(`?${params.toString()}`);
	};

	return (
		<WorkspaceContext.Provider
			value={{
				currentWorkspaceId,
				workspaces,
				isLoading,
				switchWorkspace,
				refetchWorkspaces,
			}}
		>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace() {
	const context = useContext(WorkspaceContext);
	if (context === undefined) {
		throw new Error("useWorkspace must be used within a WorkspaceProvider");
	}
	return context;
}

// Custom hook that provides workspace-scoped API calls
export function useWorkspaceApi() {
	const { currentWorkspaceId } = useWorkspace();

	return {
		// Expense Categories
		expenseCategories: {
			getAll: () =>
				api.expenseCategories.getAll.useQuery(
					{ workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId },
				),
			create: () => api.expenseCategories.create.useMutation(),
			update: () => api.expenseCategories.update.useMutation(),
			delete: () => api.expenseCategories.delete.useMutation(),
		},
		// Current Accounts
		currentAccounts: {
			getAll: () =>
				api.currentAccounts.getAll.useQuery(
					{ workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId },
				),
			getById: (id: string) =>
				api.currentAccounts.getById.useQuery(
					{ id, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!id },
				),
			getBalanceHistory: (id: string, days = 30) =>
				api.currentAccounts.getBalanceHistory.useQuery(
					{ id, workspaceId: currentWorkspaceId ?? "", days },
					{ enabled: !!currentWorkspaceId && !!id },
				),
			create: () => api.currentAccounts.create.useMutation(),
			update: () => api.currentAccounts.update.useMutation(),
			delete: () => api.currentAccounts.delete.useMutation(),
			recomputeBalances: () =>
				api.currentAccounts.recomputeBalances.useMutation(),
		},
		// Recurring Expenses
		recurringExpenses: {
			getAll: () =>
				api.recurringExpenses.getAll.useQuery(
					{ workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId },
				),
			create: () => api.recurringExpenses.create.useMutation(),
			update: () => api.recurringExpenses.update.useMutation(),
			delete: () => api.recurringExpenses.delete.useMutation(),
		},
		// Transactions
		transactions: {
			getByAccountId: (
				accountId: string,
				options?: {
					page?: number;
					pageSize?: number;
					handled?: "all" | "handled" | "unhandled";
				},
			) =>
				api.transactions.getByAccountId.useQuery(
					{
						accountId,
						workspaceId: currentWorkspaceId ?? "",
						...options,
					},
					{ enabled: !!currentWorkspaceId && !!accountId },
				),
			getById: (id: string) =>
				api.transactions.getById.useQuery(
					{ id, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!id },
				),
			getSplitsByTransactionId: (transactionId: string) =>
				api.transactions.getSplitsByTransactionId.useQuery(
					{
						transactionId,
						workspaceId: currentWorkspaceId ?? "",
					},
					{ enabled: !!currentWorkspaceId && !!transactionId },
				),
			getSplitsByAccountId: (accountId: string) =>
				api.transactions.getSplitsByAccountId.useQuery(
					{
						accountId,
						workspaceId: currentWorkspaceId ?? "",
					},
					{ enabled: !!currentWorkspaceId && !!accountId },
				),
			updateExpenseCategory: () =>
				api.transactions.updateExpenseCategory.useMutation(),
			updateHandled: () => api.transactions.updateHandled.useMutation(),
			createSplits: () => api.transactions.createSplits.useMutation(),
			createManualSplit: () => api.transactions.createManualSplit.useMutation(),
			deleteSplit: () => api.transactions.deleteSplit.useMutation(),
			deleteAllSplits: () => api.transactions.deleteAllSplits.useMutation(),
			delete: () => api.transactions.delete.useMutation(),
			getOwedBalanceByAccountId: (accountId: string) =>
				api.transactions.getOwedBalanceByAccountId.useQuery(
					{ accountId, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!accountId },
				),
			getDebtMatrix: api.transactions.getDebtMatrix,
		},
		// Statements
		statements: {
			getByAccountId: (accountId: string) =>
				api.statements.getByAccountId.useQuery(
					{ accountId, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!accountId },
				),
			create: () => api.statements.create.useMutation(),
			update: () => api.statements.update.useMutation(),
			delete: () => api.statements.delete.useMutation(),
			download: () => api.statements.download.useMutation(),
			parseStatement: () => api.statements.parseStatement.useMutation(),
		},
		// Statement Imports (staged transactions awaiting review)
		statementImports: {
			getPendingByAccountId: (accountId: string) =>
				api.statementImports.getPendingByAccountId.useQuery(
					{ accountId, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!accountId },
				),
			getPendingByStatementId: (statementId: string) =>
				api.statementImports.getPendingByStatementId.useQuery(
					{ statementId, workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId && !!statementId },
				),
			updateBatch: () => api.statementImports.updateBatch.useMutation(),
			addStagedTransaction: () =>
				api.statementImports.addStagedTransaction.useMutation(),
			updateStagedTransaction: () =>
				api.statementImports.updateStagedTransaction.useMutation(),
			setStagedTransactionIncluded: () =>
				api.statementImports.setStagedTransactionIncluded.useMutation(),
			deleteStagedTransaction: () =>
				api.statementImports.deleteStagedTransaction.useMutation(),
			approveBatch: () => api.statementImports.approveBatch.useMutation(),
			discardBatch: () => api.statementImports.discardBatch.useMutation(),
		},
		// Time Tracking
		timeTracking: {
			getAll: (options?: { limit?: number }) =>
				api.timeTracking.getAll.useQuery(
					{ workspaceId: currentWorkspaceId ?? "", ...options },
					{ enabled: !!currentWorkspaceId },
				),
			getLatest: () =>
				api.timeTracking.getLatest.useQuery(
					{ workspaceId: currentWorkspaceId ?? "" },
					{ enabled: !!currentWorkspaceId },
				),
			getByDateRange: (startDate: Date, endDate: Date) =>
				api.timeTracking.getByDateRange.useQuery(
					{
						workspaceId: currentWorkspaceId ?? "",
						startDate,
						endDate,
					},
					{ enabled: !!currentWorkspaceId },
				),
			getStats: (options: { startDate: Date; endDate: Date }) =>
				api.timeTracking.getStats.useQuery(
					{
						workspaceId: currentWorkspaceId ?? "",
						...options,
					},
					{ enabled: !!currentWorkspaceId },
				),
			create: () => api.timeTracking.create.useMutation(),
			update: () => api.timeTracking.update.useMutation(),
			delete: () => api.timeTracking.delete.useMutation(),
		},
		// Current workspace ID for manual usage
		workspaceId: currentWorkspaceId,
	};
}
