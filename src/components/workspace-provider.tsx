"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "grandeo/trpc/react";

interface WorkspaceContextType {
	currentWorkspaceId: string | null;
	workspaces: Array<{
		id: string;
		name: string;
		description: string | null;
		role: string;
		createdAt: Date | null;
	}> | undefined;
	isLoading: boolean;
	switchWorkspace: (workspaceId: string) => void;
	refetchWorkspaces: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

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
		if (!isLoading && workspaces && workspaces.length > 0 && !currentWorkspaceId) {
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
			getAll: () => api.expenseCategories.getAll.useQuery(
				{ workspaceId: currentWorkspaceId ?? "" },
				{ enabled: !!currentWorkspaceId }
			),
			create: () => api.expenseCategories.create.useMutation(),
			update: () => api.expenseCategories.update.useMutation(),
			delete: () => api.expenseCategories.delete.useMutation(),
		},
		// Current Accounts
		currentAccounts: {
			getAll: () => api.currentAccounts.getAll.useQuery(
				{ workspaceId: currentWorkspaceId ?? "" },
				{ enabled: !!currentWorkspaceId }
			),
			getById: (id: string) => api.currentAccounts.getById.useQuery(
				{ id, workspaceId: currentWorkspaceId ?? "" },
				{ enabled: !!currentWorkspaceId && !!id }
			),
			create: () => api.currentAccounts.create.useMutation(),
			update: () => api.currentAccounts.update.useMutation(),
			delete: () => api.currentAccounts.delete.useMutation(),
		},
		// Recurring Expenses
		recurringExpenses: {
			getAll: () => api.recurringExpenses.getAll.useQuery(
				{ workspaceId: currentWorkspaceId ?? "" },
				{ enabled: !!currentWorkspaceId }
			),
			create: () => api.recurringExpenses.create.useMutation(),
			update: () => api.recurringExpenses.update.useMutation(),
			delete: () => api.recurringExpenses.delete.useMutation(),
		},
		// Transactions
		transactions: {
			getByAccountId: (accountId: string, options?: { page?: number; pageSize?: number; handled?: "all" | "handled" | "unhandled" }) => 
				api.transactions.getByAccountId.useQuery(
					{ 
						accountId, 
						workspaceId: currentWorkspaceId ?? "",
						...options
					},
					{ enabled: !!currentWorkspaceId && !!accountId }
				),
			updateExpenseCategory: () => api.transactions.updateExpenseCategory.useMutation(),
			updateHandled: () => api.transactions.updateHandled.useMutation(),
			createSplits: () => api.transactions.createSplits.useMutation(),
		},
		// Current workspace ID for manual usage
		workspaceId: currentWorkspaceId,
	};
}
