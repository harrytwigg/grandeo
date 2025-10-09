"use client";

import { useWorkspace } from "grandeo/components/workspace-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { currentWorkspaceId, workspaces, isLoading } = useWorkspace();

	useEffect(() => {
		// Wait for data to load
		if (isLoading) {
			return;
		}

		// If on select-workspace page with a workspace param, redirect to home with that workspace
		if (pathname === "/select-workspace" && searchParams.get("workspace")) {
			const workspaceId = searchParams.get("workspace");
			router.replace(`/?workspace=${workspaceId}`);
			return;
		}

		// Don't redirect if we're already on the select-workspace page
		if (pathname === "/select-workspace") {
			return;
		}

		// If user has no workspaces or no workspace selected, redirect to select-workspace
		if (!currentWorkspaceId || !workspaces || workspaces.length === 0) {
			router.replace("/select-workspace");
		}
	}, [
		currentWorkspaceId,
		workspaces,
		isLoading,
		pathname,
		searchParams,
		router,
	]);

	// Show loading state while checking workspace
	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
					<p className="mt-4 text-gray-600 text-sm">Loading workspace...</p>
				</div>
			</div>
		);
	}

	// If on select-workspace page, always show it
	if (pathname === "/select-workspace") {
		return <>{children}</>;
	}

	// Only show children if user has a workspace selected
	if (currentWorkspaceId && workspaces && workspaces.length > 0) {
		return <>{children}</>;
	}

	// Show nothing while redirecting
	return null;
}
