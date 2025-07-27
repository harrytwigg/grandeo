"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "grandeo/trpc/react";

export function UserInitializer({ children }: { children: React.ReactNode }) {
	const { user, isLoaded } = useUser();

	const upsertUser = api.users.upsert.useMutation();

	useEffect(() => {
		if (isLoaded && user) {
			// Upsert user data to our database
			upsertUser.mutate({
				email: user.emailAddresses[0]?.emailAddress ?? "",
				firstName: user.firstName ?? undefined,
				lastName: user.lastName ?? undefined,
				imageUrl: user.imageUrl ?? undefined,
			});
		}
	}, [isLoaded, user]);

	// Don't render children until user is loaded and upserted
	if (!isLoaded || (user && upsertUser.isPending)) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
