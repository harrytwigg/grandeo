"use client";

import { useWorkspace } from "grandeo/contexts/workspace-context";

// Hook that provides current workspace context
export function useWorkspaceApi() {
	const { currentWorkspaceId, currentWorkspace, isLoading } = useWorkspace();

	return {
		currentWorkspaceId,
		currentWorkspace,
		isLoading,
	};
}
