"use client";

import { DashboardLayout } from "grandeo/components/dashboard-layout";
import { Badge } from "grandeo/components/ui/badge";
import { Button } from "grandeo/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "grandeo/components/ui/card";
import { Input } from "grandeo/components/ui/input";
import { Label } from "grandeo/components/ui/label";
import { Slider } from "grandeo/components/ui/slider";
import { Switch } from "grandeo/components/ui/switch";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import {
	BatteryChargingIcon,
	BatteryLowIcon,
	PlusIcon,
	TimerIcon,
	TrashIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Checkbox } from "grandeo/components/ui/checkbox";

export default function TimeTrackingPage() {
	const workspaceApi = useWorkspaceApi();
	const [description, setDescription] = useState("");
	const [moneyValue, setMoneyValue] = useState(2);
	const [isEnergizing, setIsEnergizing] = useState(true);
	const [manualStartTime, setManualStartTime] = useState("");

	// suggestion dropdown state
	const [openSuggestions, setOpenSuggestions] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const suggestionsRef = useRef<HTMLUListElement>(null);
	const descriptionInputRef = useRef<HTMLInputElement>(null);

	// TRPC queries and mutations
	const { data: rawEntries, refetch } = workspaceApi.timeTracking.getAll({
		limit: 10,
	});

	// most recent first
	const entries = rawEntries
		? [...rawEntries].sort(
				(a, b) =>
					new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
			)
		: [];

	const createEntry = workspaceApi.timeTracking.create();
	const deleteEntry = workspaceApi.timeTracking.delete();

	useEffect(() => {
		descriptionInputRef.current?.focus();
	}, []);

	const handleCreateEntry = () => {
		if (description.trim() && workspaceApi.workspaceId) {
			createEntry.mutate(
				{
					workspaceId: workspaceApi.workspaceId,
					description: description.trim(),
					moneyValue,
					isEnergizing,
					startTime: manualStartTime ? new Date(manualStartTime) : undefined,
				},
				{
					onSuccess: () => {
						refetch();
						setDescription("");
						setMoneyValue(2);
						setIsEnergizing(true);
						setManualStartTime("");
						setOpenSuggestions(false);
						descriptionInputRef.current?.focus();
					},
				},
			);
		}
	};

	const handleDeleteEntry = (id: string) => {
		if (workspaceApi.workspaceId) {
			deleteEntry.mutate(
				{ id },
				{
					onSuccess: () => {
						refetch();
					},
				},
			);
		}
	};

	const getMoneyValueLabel = (value: number) => {
		const labels: Record<number, string> = {
			1: "Not Making Money",
			2: "Low Money Value",
			3: "Good Money Value",
			4: "High Money Value",
		};
		return labels[value] || "Unknown";
	};

	const formatDuration = (startTime: Date, endTime?: Date | null) => {
		const start = new Date(startTime);
		const end = endTime ? new Date(endTime) : new Date();
		const durationMs = end.getTime() - start.getTime();
		const minutes = Math.floor(durationMs / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
	};

	const formatTime = (date: Date) =>
		new Date(date).toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});

	const formatDate = (date: Date) =>
		new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});

	const getTimePreview = () => {
		if (!entries || entries.length === 0) return "First entry - will start now";

		const lastEntry = entries[0];
		if (!lastEntry) return "Will start now";

		const startTime = manualStartTime
			? new Date(manualStartTime)
			: lastEntry.endTime
				? new Date(lastEntry.endTime)
				: new Date();

		const endTime = new Date();
		return `${formatTime(startTime)} → ${formatTime(endTime)}`;
	};

	// ---- Fuzzy suggestions from prior descriptions ----
	const priorDescriptions = useMemo(() => {
		const set = new Set<string>();
		for (const e of entries) {
			const d = (e.description || "").trim();
			if (d) set.add(d);
		}
		return Array.from(set);
	}, [entries]);

	// Map description -> most recent entry for prefill
	const descToLatest = useMemo(() => {
		const map = new Map<string, (typeof entries)[number]>();
		for (const e of entries) {
			const d = (e.description || "").trim();
			if (d && !map.has(d)) map.set(d, e); // entries is newest-first
		}
		return map;
	}, [entries]);

	const fuse = useMemo(() => {
		return new Fuse(priorDescriptions, {
			includeScore: true,
			threshold: 0.35,
			ignoreLocation: true,
			minMatchCharLength: 2,
		});
	}, [priorDescriptions]);

	const suggestions = useMemo(() => {
		const q = description.trim();
		if (!q) return priorDescriptions.slice(0, 8);
		return fuse.search(q, { limit: 8 }).map((r) => r.item);
	}, [description, fuse, priorDescriptions]);

	useEffect(() => {
		setHighlightIndex(0);
	}, [description, priorDescriptions.length]);

	const selectSuggestion = (value: string) => {
		setDescription(value);
		// pre-fill from most recent matching entry
		const match = descToLatest.get(value);
		if (match) {
			setMoneyValue(match.moneyValue);
			setIsEnergizing(!!match.isEnergizing);
		}
		setOpenSuggestions(false);
		descriptionInputRef.current?.focus();
	};

	// Enter no longer creates an entry. It only selects a highlighted suggestion when open.
	const onDescKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
		if (!openSuggestions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
			setOpenSuggestions(true);
			return;
		}
		if (!openSuggestions) {
			// Block Enter from creating an entry
			if (e.key === "Enter") {
				e.preventDefault();
			}
			return;
		}

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlightIndex((i) =>
				Math.min(i + 1, Math.max(0, suggestions.length - 1)),
			);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlightIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (suggestions[highlightIndex]) {
				selectSuggestion(suggestions[highlightIndex]);
			}
		} else if (e.key === "Escape") {
			setOpenSuggestions(false);
		}
	};

	return (
		<DashboardLayout title="Time Tracking" showAddButton={false}>
			<div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
				{/* Quick Entry Form */}
				<Card>
					<CardHeader className="pb-4">
						<CardTitle className="text-xl">Log Time Entry</CardTitle>
						<CardDescription className="text-sm">
							{getTimePreview()}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="description" className="text-base">
									Task Description
								</Label>

								{/* Input + suggestions container */}
								<div className="relative">
									<Input
										ref={descriptionInputRef}
										id="description"
										placeholder="What were you working on?"
										value={description}
										onChange={(e) => {
											setDescription(e.target.value);
											setOpenSuggestions(true);
										}}
										onKeyDown={onDescKeyDown}
										onFocus={() => setOpenSuggestions(true)}
										onBlur={() => {
											// allow click selection before blur closes
											setTimeout(() => setOpenSuggestions(false), 100);
										}}
										className="h-12 text-base"
										autoComplete="off"
									/>

									{openSuggestions && suggestions.length > 0 && (
										<ul
											ref={suggestionsRef}
											role="listbox"
											className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
										>
											{suggestions.map((s, i) => (
												<li
													key={`${s}-${i}`}
													role="option"
													aria-selected={i === highlightIndex}
													className={[
														"cursor-pointer select-none rounded-sm px-3 py-2 text-sm",
														i === highlightIndex
															? "bg-accent text-accent-foreground"
															: "hover:bg-accent hover:text-accent-foreground",
													].join(" ")}
													onMouseDown={(e) => {
														e.preventDefault();
														selectSuggestion(s);
													}}
													onMouseEnter={() => setHighlightIndex(i)}
												>
													{s}
												</li>
											))}
										</ul>
									)}
								</div>
							</div>

							<div className="space-y-3">
								<Label htmlFor="moneyValue" className="text-base">
									Money Value: {getMoneyValueLabel(moneyValue)} ({moneyValue}/4)
								</Label>
								<Slider
									id="moneyValue"
									min={1}
									max={4}
									step={1}
									value={[moneyValue]}
									onValueChange={(value) => setMoneyValue(value[0] ?? 2)}
									className="mx-auto w-full py-2"
								/>
								<div className="flex justify-between text-muted-foreground text-sm">
									<span>Not Making Money</span>
									<span>High Value</span>
								</div>
							</div>

							<div className="flex items-center space-x-3 rounded-lg border p-4 px-12">
								<Checkbox
									id="energizing"
									checked={isEnergizing}
									onCheckedChange={(set) => setIsEnergizing(set === true)}
								/>
								<Label
									htmlFor="energizing"
									className="cursor-pointer text-base"
								>
									{isEnergizing ? (
										<span className="flex items-center gap-2">
											<BatteryChargingIcon className="h-5 w-5 text-green-500" />
											Energizing
										</span>
									) : (
										<span className="flex items-center gap-2">
											<BatteryLowIcon className="h-5 w-5 text-orange-500" />
											Draining
										</span>
									)}
								</Label>
							</div>

							<details className="rounded-lg border">
								<summary className="cursor-pointer p-4 font-medium text-sm">
									Manual Start Time (Optional)
								</summary>
								<div className="space-y-2 px-4 pb-4">
									<Input
										id="startTime"
										type="datetime-local"
										value={manualStartTime}
										onChange={(e) => setManualStartTime(e.target.value)}
										className="h-12"
									/>
									<p className="text-muted-foreground text-xs">
										Leave blank to auto-calculate from your last entry's end
										time
									</p>
								</div>
							</details>

							<Button
								onClick={handleCreateEntry}
								disabled={!description.trim() || createEntry.isPending}
								className="h-14 w-full text-base"
								size="lg"
							>
								<PlusIcon className="mr-2 h-5 w-5" />
								{createEntry.isPending ? "Adding..." : "Add Entry"}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Recent Entries */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Recent Entries</CardTitle>
					</CardHeader>
					<CardContent>
						{entries && entries.length > 0 ? (
							<div className="space-y-3">
								{entries.map((entry) => (
									<div
										key={entry.id}
										className="flex flex-col space-y-2 rounded-lg border p-4"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="font-medium leading-tight">
													{entry.description}
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
													<span>
														{formatDate(entry.startTime)} •{" "}
														{formatTime(entry.startTime)} →{" "}
														{entry.endTime ? formatTime(entry.endTime) : "now"}
													</span>
													<span>
														• {formatDuration(entry.startTime, entry.endTime)}
													</span>
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDeleteEntry(entry.id)}
												className="h-8 w-8 shrink-0 p-0"
											>
												<TrashIcon className="h-4 w-4 text-destructive" />
											</Button>
										</div>
										<div className="flex flex-wrap gap-2">
											<Badge variant="outline" className="text-xs">
												{Array.from({ length: entry.moneyValue }).map(
													(_, i) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: display only
														<span key={i}>£</span>
													),
												)}
											</Badge>
											{entry.isEnergizing ? (
												<Badge
													variant="default"
													className="bg-green-500 text-xs"
												>
													<BatteryChargingIcon className="mr-1 h-3 w-3" />
													Energizing
												</Badge>
											) : (
												<Badge variant="destructive" className="text-xs">
													<BatteryLowIcon className="mr-1 h-3 w-3" />
													Draining
												</Badge>
											)}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="py-12 text-center">
								<TimerIcon className="mx-auto h-12 w-12 text-muted-foreground" />
								<h3 className="mt-4 font-semibold text-lg">No entries yet</h3>
								<p className="text-muted-foreground text-sm">
									Start tracking your time with the form above.
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}
