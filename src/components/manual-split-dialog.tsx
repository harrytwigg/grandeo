"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "grandeo/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "grandeo/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "grandeo/components/ui/form";
import { Input } from "grandeo/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "grandeo/components/ui/select";
import { Textarea } from "grandeo/components/ui/textarea";
import { useWorkspaceApi } from "grandeo/components/workspace-provider";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const manualSplitSchema = z.object({
	sourceAccountId: z.string().min(1, "Source account is required"),
	targetAccountId: z.string().min(1, "Target account is required"),
	amount: z.coerce.number().positive("Amount must be positive"),
	description: z.string().optional(),
});

type ManualSplitForm = z.infer<typeof manualSplitSchema>;

interface ManualSplitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentAccountId: string;
}

export function ManualSplitDialog({
	open,
	onOpenChange,
	currentAccountId,
}: ManualSplitDialogProps) {
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<ManualSplitForm>({
		resolver: zodResolver(manualSplitSchema),
		defaultValues: {
			sourceAccountId: currentAccountId,
			targetAccountId: "",
			amount: 0,
			description: "",
		},
	});

	const workspaceApi = useWorkspaceApi();

	// Get all accounts for the dropdown
	const { data: accounts } = workspaceApi.currentAccounts.getAll();

	// Watch form values to show dynamic message
	const sourceAccountId = form.watch("sourceAccountId");
	const targetAccountId = form.watch("targetAccountId");
	const amount = form.watch("amount");

	// Get account names for the message
	const sourceAccount = accounts?.find(
		(account) => account.id === sourceAccountId,
	);
	const targetAccount = accounts?.find(
		(account) => account.id === targetAccountId,
	);

	// Create manual split mutation
	const createManualSplit = workspaceApi.transactions.createManualSplit();

	const onSubmit = async (data: ManualSplitForm) => {
		if (data.sourceAccountId === data.targetAccountId) {
			toast.error("Source and target accounts cannot be the same");
			return;
		}

		setIsLoading(true);
		try {
			await createManualSplit.mutateAsync({
				...data,
				workspaceId: workspaceApi.workspaceId ?? "",
			});
			toast.success("Manual split created successfully");
			form.reset();
			onOpenChange(false);
			// Note: For full refresh, we'd need to pass refetch callbacks from parent components
		} catch (error) {
			toast.error((error as Error).message || "Failed to create manual split");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Manual Split</DialogTitle>
					<DialogDescription>
						Create a manual split to transfer money between accounts. This
						creates a standalone split not tied to any transaction.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="sourceAccountId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>From Account</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select source account" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{accounts?.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="targetAccountId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>To Account</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select target account" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{accounts
												?.filter(
													(account) =>
														account.id !== form.watch("sourceAccountId"),
												)
												?.map((account) => (
													<SelectItem key={account.id} value={account.id}>
														{account.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Dynamic message showing who owes whom */}
						{sourceAccount && targetAccount && amount > 0 && (
							<div className="rounded-md border border-blue-200 bg-blue-50 p-3">
								<p className="text-blue-800 text-sm">
									<strong>{sourceAccount.name}</strong> will owe{" "}
									<strong>{targetAccount.name}</strong> £
									{Number(amount).toFixed(2)}
								</p>
							</div>
						)}

						<FormField
							control={form.control}
							name="amount"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Amount (£)</FormLabel>
									<FormControl>
										<Input
											type="number"
											step="0.01"
											placeholder="0.00"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description (optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter a description for this split..."
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isLoading}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? "Creating..." : "Create Split"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
