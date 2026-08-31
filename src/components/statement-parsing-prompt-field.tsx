"use client";

import { Label } from "grandeo/components/ui/label";
import { Textarea } from "grandeo/components/ui/textarea";

export const STATEMENT_PARSING_PROMPT_MAX_LENGTH = 2000;

const PLACEHOLDER = `e.g. This is a credit card statement: amounts are printed as positive for spending and negative for payments, so invert the sign of every transaction.`;

interface StatementParsingPromptFieldProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	label?: string;
}

/**
 * Free-text instructions appended to the AI prompt when statements for an
 * account are parsed. Used anywhere an account can be created or edited.
 */
export function StatementParsingPromptField({
	id,
	value,
	onChange,
	disabled,
	label = "Statement parsing instructions",
}: StatementParsingPromptFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>
				{label}{" "}
				<span className="font-normal text-muted-foreground">(optional)</span>
			</Label>
			<Textarea
				id={id}
				rows={4}
				maxLength={STATEMENT_PARSING_PROMPT_MAX_LENGTH}
				placeholder={PLACEHOLDER}
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value)}
			/>
			<div className="flex items-start justify-between gap-4">
				<p className="text-muted-foreground text-sm">
					Extra context given to the AI whenever a statement for this account is
					parsed. Use it when this account's statements need special handling —
					for example a credit card that reports spending the wrong way around.
				</p>
				<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
					{value.length}/{STATEMENT_PARSING_PROMPT_MAX_LENGTH}
				</span>
			</div>
		</div>
	);
}
