"use client";

import { Button } from "grandeo/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "grandeo/components/ui/chart";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { TrendingDownIcon, TrendingUpIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

interface AccountBalanceChartProps {
	accountId: string;
	accountName: string;
}

const chartConfig = {
	balance: {
		label: "Balance",
	},
} satisfies ChartConfig;

export function AccountBalanceChart({
	accountId,
	accountName,
}: AccountBalanceChartProps) {
	const workspaceApi = useWorkspaceApi();
	const [timeRange, setTimeRange] = useState<7 | 30 | 90 | 360>(30);

	const {
		data: balanceHistory,
		isLoading,
		error,
		refetch,
	} = workspaceApi.currentAccounts.getBalanceHistory(accountId, timeRange);

	const recomputeBalances = workspaceApi.currentAccounts.recomputeBalances();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUpIcon className="h-5 w-5" />
						Balance History
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex h-[300px] items-center justify-center">
						<div className="text-muted-foreground">
							Loading balance history...
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUpIcon className="h-5 w-5" />
						Balance History
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex h-[300px] items-center justify-center">
						<div className="text-destructive">
							Failed to load balance history
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!balanceHistory || balanceHistory.length === 0) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<TrendingUpIcon className="h-5 w-5" />
								Balance History
							</CardTitle>
							<p className="mt-1 text-muted-foreground text-sm">
								{accountName} balance over the last {timeRange} days
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								recomputeBalances.mutate(
									{
										id: accountId,
										workspaceId: workspaceApi.workspaceId ?? "",
									},
									{
										onSuccess: () => {
											toast.success("Balances recomputed successfully");
											refetch();
										},
										onError: (error) => {
											toast.error(
												`Failed to recompute balances: ${error.message}`,
											);
										},
									},
								)
							}
							disabled={recomputeBalances.isPending}
						>
							<RefreshCwIcon
								className={`h-4 w-4 ${recomputeBalances.isPending ? "animate-spin" : ""}`}
							/>
							{recomputeBalances.isPending ? "Computing..." : "Recompute"}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex h-[300px] items-center justify-center">
						<div className="text-muted-foreground">
							No balance data available. Click "Recompute" to generate balance
							history.
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Calculate trend
	const firstBalance = balanceHistory[0]?.balance ?? 0;
	const lastBalance = balanceHistory[balanceHistory.length - 1]?.balance ?? 0;
	const trend = lastBalance - firstBalance;
	const trendPercentage =
		firstBalance !== 0 ? (trend / Math.abs(firstBalance)) * 100 : 0;

	// Format data for chart
	const chartData = balanceHistory.map(
		(item: { date: string; balance: number }) => ({
			date: new Date(item.date).toLocaleDateString("en-GB", {
				month: "short",
				day: "numeric",
			}),
			balance: item.balance,
			fullDate: item.date,
		}),
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div>
					<CardTitle className="flex items-center gap-2">
						<TrendingUpIcon className="h-5 w-5" />
						Balance History
					</CardTitle>
					<p className="mt-1 text-muted-foreground text-sm">
						{accountName} balance over the last {timeRange} days
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							recomputeBalances.mutate(
								{
									id: accountId,
									workspaceId: workspaceApi.workspaceId ?? "",
								},
								{
									onSuccess: () => {
										toast.success("Balances recomputed successfully");
										refetch();
									},
									onError: (error) => {
										toast.error(
											`Failed to recompute balances: ${error.message}`,
										);
									},
								},
							)
						}
						disabled={recomputeBalances.isPending}
					>
						<RefreshCwIcon
							className={`h-4 w-4 ${recomputeBalances.isPending ? "animate-spin" : ""}`}
						/>
						{recomputeBalances.isPending ? "Computing..." : "Recompute"}
					</Button>
					<Button
						variant={timeRange === 7 ? "default" : "outline"}
						size="sm"
						onClick={() => setTimeRange(7)}
					>
						7D
					</Button>
					<Button
						variant={timeRange === 30 ? "default" : "outline"}
						size="sm"
						onClick={() => setTimeRange(30)}
					>
						30D
					</Button>
					<Button
						variant={timeRange === 90 ? "default" : "outline"}
						size="sm"
						onClick={() => setTimeRange(90)}
					>
						90D
					</Button>
					<Button
						variant={timeRange === 360 ? "default" : "outline"}
						size="sm"
						onClick={() => setTimeRange(360)}
					>
						1Y
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="mb-4 flex items-center gap-4">
					<div className="flex items-center gap-2">
						<span className="font-bold text-2xl">
							£
							{lastBalance.toLocaleString("en-GB", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</span>
						<div
							className={`flex items-center gap-1 text-sm ${
								trend >= 0 ? "text-green-600" : "text-red-600"
							}`}
						>
							{trend >= 0 ? (
								<TrendingUpIcon className="h-4 w-4" />
							) : (
								<TrendingDownIcon className="h-4 w-4" />
							)}
							<span>
								{trend >= 0 ? "+" : ""}£{trend.toFixed(2)} (
								{trend >= 0 ? "+" : ""}
								{trendPercentage.toFixed(1)}%)
							</span>
						</div>
					</div>
				</div>

				<ChartContainer config={chartConfig} className="h-[300px] w-full">
					<LineChart accessibilityLayer data={chartData}>
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							className="text-xs"
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							className="text-xs"
							tickFormatter={(value) =>
								`£${value.toLocaleString("en-GB", {
									minimumFractionDigits: 0,
									maximumFractionDigits: 0,
								})}`
							}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="w-[180px]"
									labelFormatter={(value) => {
										const item = chartData.find(
											(d: {
												date: string;
												balance: number;
												fullDate: string;
											}) => d.date === value,
										);
										return item?.fullDate
											? new Date(item.fullDate).toLocaleDateString("en-GB", {
													weekday: "long",
													year: "numeric",
													month: "long",
													day: "numeric",
												})
											: value;
									}}
									formatter={(value) => [
										`£${Number(value).toLocaleString("en-GB", {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}`,
										"Balance",
									]}
								/>
							}
						/>
						<Line
							dataKey="balance"
							stroke="var(--color-chart-2)"
							strokeWidth={3}
							dot={false}
							activeDot={{
								r: 6,
								fill: "var(--color-chart-2)",
							}}
						/>
					</LineChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
