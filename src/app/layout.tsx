import "grandeo/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import {
	ClerkProvider,
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from "@clerk/nextjs";
import { TRPCReactProvider } from "grandeo/trpc/react";
import { WorkspaceProvider } from "grandeo/components/workspace-provider";
import { UserInitializer } from "grandeo/components/user-initializer";

export const metadata: Metadata = {
	title: "Grandeo - Money Tracker",
	description: "Track your finances with ease",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<ClerkProvider>
			<html lang="en" className={`${geist.variable}`}>
				<body>
					<TRPCReactProvider>
						<SignedIn>
							<UserInitializer>
								<WorkspaceProvider>{children}</WorkspaceProvider>
							</UserInitializer>
						</SignedIn>
						<SignedOut>
							{children}
						</SignedOut>
					</TRPCReactProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
