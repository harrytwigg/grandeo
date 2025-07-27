"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "grandeo/trpc/react";

interface Workspace {
	id: string;
	name: string;
	description?: string | null;
	role: string;
	createdAt: Date | null;
}

interface WorkspaceContextType {
	currentWorkspaceId: string | null;
	currentWorkspace: Workspace | undefined;
	setCurrentWorkspace: (workspaceId: string) => void;
	isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
		null,
	);

	const { data: workspaces, isLoading: workspacesLoading } =
		api.workspaces.getAll.useQuery();

	const { data: currentWorkspace, isLoading: workspaceLoading } =
		api.workspaces.getById.useQuery(
			{ id: currentWorkspaceId ?? "" },
			{ enabled: !!currentWorkspaceId },
		);

	// Update workspace from URL params
	useEffect(() => {
		const workspaceId = searchParams.get("workspace");
		setCurrentWorkspaceId(workspaceId);
	}, [searchParams]);

	// Auto-select first workspace if none selected and workspaces are available
	useEffect(() => {
		if (
			!workspacesLoading &&
			workspaces &&
			workspaces.length > 0 &&
			!currentWorkspaceId
		) {
			const firstWorkspace = workspaces[0];
			if (firstWorkspace) {
				setCurrentWorkspace(firstWorkspace.id);
			}
		}
	}, [workspaces, workspacesLoading, currentWorkspaceId]);

	const setCurrentWorkspace = (workspaceId: string) => {
		const params = new URLSearchParams(searchParams);
		params.set("workspace", workspaceId);
		router.push(`?${params.toString()}`);
	};

	const isLoading = workspacesLoading || workspaceLoading;

	return (
		<WorkspaceContext.Provider
			value={{
				currentWorkspaceId,
				currentWorkspace,
				setCurrentWorkspace,
				isLoading,
			}}
		>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace() {
	const context = useContext(WorkspaceContext);
	if (!context) {
		throw new Error("useWorkspace must be used within a WorkspaceProvider");
	}
	return context;
}
