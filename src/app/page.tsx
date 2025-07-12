import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import { DashboardLayout } from "grandeo/components/dashboard-layout";
import {
	CreditCardIcon,
	PiggyBankIcon,
	TrendingUpIcon,
	WalletIcon,
	BarChart3Icon,
	CalendarIcon,
	PlusIcon,
} from "lucide-react";

export default function Home() {
	return (
		<DashboardLayout title="Dashboard">
			<div className="grid gap-6">
				{/* Welcome Section */}
				<div className="space-y-2">
					<h1 className="font-bold text-2xl">Welcome to Grandeo</h1>
					<p className="text-muted-foreground">
						Track your finances, manage recurring expenses, and stay on top of
						your budget.
					</p>
				</div>

				{/* Quick Stats */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Total Balance
							</CardTitle>
							<WalletIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">£2,847.32</div>
							<p className="text-muted-foreground text-xs">
								+2.1% from last month
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Monthly Expenses
							</CardTitle>
							<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">£1,234.56</div>
							<p className="text-muted-foreground text-xs">
								-4.2% from last month
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Recurring Expenses
							</CardTitle>
							<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">£892.10</div>
							<p className="text-muted-foreground text-xs">
								5 active subscriptions
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Savings Goal
							</CardTitle>
							<PiggyBankIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">68%</div>
							<p className="text-muted-foreground text-xs">
								£680 of £1,000 target
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Recent Activity */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>
							Your latest transactions and account updates
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
										<PlusIcon className="h-4 w-4 text-green-600" />
									</div>
									<div>
										<p className="font-medium">Salary Deposit</p>
										<p className="text-muted-foreground text-sm">
											Today at 9:00 AM
										</p>
									</div>
								</div>
								<div className="text-right">
									<p className="font-medium text-green-600">+£2,500.00</p>
									<p className="text-muted-foreground text-sm">Main Account</p>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
										<CreditCardIcon className="h-4 w-4 text-red-600" />
									</div>
									<div>
										<p className="font-medium">Netflix Subscription</p>
										<p className="text-muted-foreground text-sm">
											Yesterday at 3:24 PM
										</p>
									</div>
								</div>
								<div className="text-right">
									<p className="font-medium text-red-600">-£12.99</p>
									<p className="text-muted-foreground text-sm">Entertainment</p>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
										<BarChart3Icon className="h-4 w-4 text-blue-600" />
									</div>
									<div>
										<p className="font-medium">Investment Return</p>
										<p className="text-muted-foreground text-sm">
											Dec 10, 2024
										</p>
									</div>
								</div>
								<div className="text-right">
									<p className="font-medium text-blue-600">+£45.67</p>
									<p className="text-muted-foreground text-sm">
										Savings Account
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}
