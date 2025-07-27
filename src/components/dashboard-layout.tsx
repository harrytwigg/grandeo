import {
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from "@clerk/nextjs";
import { Button } from "grandeo/components/ui/button";
import { Separator } from "grandeo/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "grandeo/components/ui/sidebar";
import { WorkspaceSwitcher } from "grandeo/components/workspace-switcher";
import {
	BarChart3Icon,
	CalendarIcon,
	CreditCardIcon,
	HomeIcon,
	PiggyBankIcon,
	PlusIcon,
	SettingsIcon,
	TrendingUpIcon,
	WalletIcon,
} from "lucide-react";
import Link from "next/link";

interface DashboardLayoutProps {
	children: React.ReactNode;
	title?: string;
	showAddButton?: boolean;
}

export function DashboardLayout({
	children,
	title = "Dashboard",
	showAddButton = true,
}: DashboardLayoutProps) {
	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				<Sidebar>
					<SidebarHeader className="h-16 border-b px-6 py-4">
						<div className="flex items-center gap-2">
							<WalletIcon className="h-6 w-6 text-primary" />
							<h1 className="font-bold text-xl">Grandeo</h1>
						</div>
					</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Overview</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link href="/" className="flex items-center gap-3">
												<HomeIcon className="h-4 w-4" />
												<span>Dashboard</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link
												href="/accounts"
												className="flex items-center gap-3"
											>
												<CreditCardIcon className="h-4 w-4" />
												<span>Accounts</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link
												href="/analytics"
												className="flex items-center gap-3"
											>
												<BarChart3Icon className="h-4 w-4" />
												<span>Analytics</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						<SidebarGroup>
							<SidebarGroupLabel>Expenses</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link
												href="/recurring"
												className="flex items-center gap-3"
											>
												<TrendingUpIcon className="h-4 w-4" />
												<span>Recurring</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>

									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link href="/savings" className="flex items-center gap-3">
												<PiggyBankIcon className="h-4 w-4" />
												<span>Savings</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						<SidebarGroup>
							<SidebarGroupLabel>Settings</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton asChild>
											<Link
												href="/expense-categories"
												className="flex items-center gap-3"
											>
												<CalendarIcon className="h-4 w-4" />
												<span>Expense Categories</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						{/* Auth Section at the bottom */}
						<div className="mt-auto space-y-4 border-t p-4">
							{/* Workspace Switcher */}
							<SignedIn>
								<div className="space-y-2">
									<div className="font-medium text-muted-foreground text-xs">
										WORKSPACE
									</div>
									<WorkspaceSwitcher />
								</div>
							</SignedIn>

							{/* Auth buttons */}
							<SignedOut>
								<div className="space-y-2">
									<SignInButton>
										<Button
											variant="outline"
											size="sm"
											className="w-full justify-start"
										>
											Sign In
										</Button>
									</SignInButton>
									<SignUpButton>
										<Button
											size="sm"
											className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90"
										>
											Sign Up
										</Button>
									</SignUpButton>
								</div>
							</SignedOut>
							<SignedIn>
								<UserButton showName />
							</SignedIn>
						</div>
					</SidebarContent>
				</Sidebar>

				<SidebarInset className="flex-1">
					{/* Header */}
					<header className="flex h-16 shrink-0 items-center gap-4 border-b px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-6" />
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-lg">{title}</h2>
						</div>
						{showAddButton && (
							<div className="ml-auto flex items-center gap-2">
								<Button size="sm" className="gap-2">
									<PlusIcon className="h-4 w-4" />
									Add Transaction
								</Button>
							</div>
						)}
					</header>

					{/* Main Content */}
					<main className="flex-1 overflow-auto p-6">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
