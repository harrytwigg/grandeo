import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `grandeo_${name}`);

export const users = createTable(
	"user",
	(d) => ({
		id: d.text({ length: 255 }).notNull().primaryKey(), // This will be the Clerk user ID
		email: d.text({ length: 255 }).notNull().unique(),
		firstName: d.text({ length: 255 }),
		lastName: d.text({ length: 255 }),
		imageUrl: d.text({ length: 500 }),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [index("user_email_idx").on(t.email)],
);

export const workspaces = createTable(
	"workspace",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: d.text({ length: 255 }).notNull(),
		description: d.text({ length: 500 }),
		createdBy: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("workspace_name_idx").on(t.name),
		index("workspace_created_by_idx").on(t.createdBy),
	],
);

export const workspaceMemberships = createTable(
	"workspace_membership",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: d.text({ length: 50 }).notNull().default("member"), // 'admin', 'member'
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("workspace_membership_workspace_idx").on(t.workspaceId),
		index("workspace_membership_user_idx").on(t.userId),
		// Unique constraint to prevent duplicate memberships
		index("workspace_membership_unique_idx").on(t.workspaceId, t.userId),
	],
);

export const currentAccounts = createTable(
	"current_account",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: d.text({ length: 255 }).notNull(),
		accountType: d.text({ length: 50 }).notNull().default("current_account"), // 'current_account' or 'credit_card'
		// Free-text instructions appended to the AI prompt when parsing statements
		// for this account, e.g. "amounts on this credit card statement are shown
		// as positive for spending - invert the sign".
		statementParsingPrompt: d.text({ length: 2000 }),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("current_account_workspace_idx").on(t.workspaceId),
		index("current_account_name_idx").on(t.name),
		index("current_account_type_idx").on(t.accountType),
		// Unique name per workspace
		index("current_account_workspace_name_idx").on(t.workspaceId, t.name),
	],
);

export const expenseCategories = createTable(
	"expense_category",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: d.text({ length: 255 }).notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("expense_category_workspace_idx").on(t.workspaceId),
		index("expense_category_name_idx").on(t.name),
		// Unique name per workspace
		index("expense_category_workspace_name_idx").on(t.workspaceId, t.name),
	],
);

export const recurringExpenses = createTable(
	"recurring_expense",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: d.text({ length: 255 }).notNull(),
		amountInPounds: d.real().notNull(),
		expenseCategoryId: d
			.text({ length: 255 })
			.notNull()
			.references(() => expenseCategories.id),
		currentAccountId: d
			.text({ length: 255 })
			.notNull()
			.references(() => currentAccounts.id),
		startDate: d.integer({ mode: "timestamp" }).notNull(),
		endDate: d.integer({ mode: "timestamp" }),
		frequency: d.text({ length: 50 }).notNull(), // 'daily', 'weekly', 'monthly', 'annually'
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("recurring_expense_workspace_idx").on(t.workspaceId),
		index("recurring_expense_category_idx").on(t.expenseCategoryId),
		index("recurring_expense_account_idx").on(t.currentAccountId),
		index("recurring_expense_start_date_idx").on(t.startDate),
		index("recurring_expense_frequency_idx").on(t.frequency),
	],
);

export const accountBalances = createTable(
	"account_balance",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		currentAccountId: d
			.text({ length: 255 })
			.notNull()
			.references(() => currentAccounts.id),
		date: d.integer({ mode: "timestamp" }).notNull(),
		balance: d.real().notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("account_balance_workspace_idx").on(t.workspaceId),
		index("account_balance_account_idx").on(t.currentAccountId),
		index("account_balance_date_idx").on(t.date),
		index("account_balance_account_date_idx").on(t.currentAccountId, t.date),
	],
);

export const statements = createTable(
	"statement",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		currentAccountId: d
			.text({ length: 255 })
			.notNull()
			.references(() => currentAccounts.id),
		periodStartDate: d.integer({ mode: "timestamp" }),
		periodEndDate: d.integer({ mode: "timestamp" }),
		openingBalance: d.real(),
		closingBalance: d.real(),
		sourceFileName: d.text({ length: 255 }).notNull(),
		sourcePathDataBucket: d.text({ length: 255 }).notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("statement_workspace_idx").on(t.workspaceId),
		index("statement_account_idx").on(t.currentAccountId),
		index("statement_period_idx").on(t.periodStartDate, t.periodEndDate),
	],
);

export const transactions = createTable(
	"transaction",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		currentAccountId: d
			.text({ length: 255 })
			.notNull()
			.references(() => currentAccounts.id),
		sourceStatementId: d.text({ length: 255 }).references(() => statements.id),
		expenseCategoryId: d
			.text({ length: 255 })
			.references(() => expenseCategories.id),
		amountInPounds: d.real().notNull(), // Positive for credits, negative for debits
		description: d.text({ length: 500 }),
		date: d.integer({ mode: "timestamp" }).notNull(),
		handled: d.integer({ mode: "boolean" }).notNull().default(false),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("transaction_workspace_idx").on(t.workspaceId),
		index("transaction_account_idx").on(t.currentAccountId),
		index("transaction_date_idx").on(t.date),
		index("transaction_account_date_idx").on(t.currentAccountId, t.date),
		index("transaction_expense_category_idx").on(t.expenseCategoryId),
		index("transaction_source_statement_idx").on(t.sourceStatementId),
	],
);

export const transactionSplits = createTable(
	"transaction_split",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		sourceTransactionId: d
			.text({ length: 255 })
			.references(() => transactions.id, { onDelete: "cascade" }), // Optional - null for standalone splits
		sourceAccountId: d
			.text({ length: 255 })
			.references(() => currentAccounts.id), // For standalone splits - the account this split is from
		currentAccountId: d
			.text({ length: 255 })
			.notNull()
			.references(() => currentAccounts.id),
		amountInPounds: d.real().notNull(), // Must sum to original transaction amount (for linked splits) or standalone amount
		description: d.text({ length: 500 }), // Optional override or main description for standalone splits
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("transaction_split_workspace_idx").on(t.workspaceId),
		index("transaction_split_source_transaction_idx").on(t.sourceTransactionId),
		index("transaction_split_source_account_idx").on(t.sourceAccountId),
		index("transaction_split_account_idx").on(t.currentAccountId),
	],
);

export const timeEntries = createTable(
	"time_entry",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		workspaceId: d
			.text({ length: 255 })
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		description: d.text({ length: 500 }).notNull(),
		moneyValue: d.integer().notNull(), // 1-4 scale (1 = not making money, 4 = making lots of money)
		isEnergizing: d.integer({ mode: "boolean" }).notNull(), // true = giving energy, false = draining
		startTime: d.integer({ mode: "timestamp" }).notNull(),
		endTime: d.integer({ mode: "timestamp" }),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("time_entry_workspace_idx").on(t.workspaceId),
		index("time_entry_user_idx").on(t.userId),
		index("time_entry_start_time_idx").on(t.startTime),
		index("time_entry_workspace_user_idx").on(t.workspaceId, t.userId),
		index("time_entry_workspace_start_idx").on(t.workspaceId, t.startTime),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	workspaceMemberships: many(workspaceMemberships),
	createdWorkspaces: many(workspaces),
	timeEntries: many(timeEntries),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
	createdBy: one(users, {
		fields: [workspaces.createdBy],
		references: [users.id],
	}),
	memberships: many(workspaceMemberships),
	currentAccounts: many(currentAccounts),
	expenseCategories: many(expenseCategories),
	recurringExpenses: many(recurringExpenses),
	accountBalances: many(accountBalances),
	statements: many(statements),
	transactions: many(transactions),
	transactionSplits: many(transactionSplits),
	timeEntries: many(timeEntries),
}));

export const workspaceMembershipsRelations = relations(
	workspaceMemberships,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceMemberships.workspaceId],
			references: [workspaces.id],
		}),
		user: one(users, {
			fields: [workspaceMemberships.userId],
			references: [users.id],
		}),
	}),
);

export const recurringExpensesRelations = relations(
	recurringExpenses,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [recurringExpenses.workspaceId],
			references: [workspaces.id],
		}),
		expenseCategory: one(expenseCategories, {
			fields: [recurringExpenses.expenseCategoryId],
			references: [expenseCategories.id],
		}),
		currentAccount: one(currentAccounts, {
			fields: [recurringExpenses.currentAccountId],
			references: [currentAccounts.id],
		}),
	}),
);

export const expenseCategoriesRelations = relations(
	expenseCategories,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [expenseCategories.workspaceId],
			references: [workspaces.id],
		}),
		recurringExpenses: many(recurringExpenses),
		transactions: many(transactions),
	}),
);

export const currentAccountsRelations = relations(
	currentAccounts,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [currentAccounts.workspaceId],
			references: [workspaces.id],
		}),
		recurringExpenses: many(recurringExpenses),
		accountBalances: many(accountBalances),
		statements: many(statements),
		transactions: many(transactions),
	}),
);

export const accountBalancesRelations = relations(
	accountBalances,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [accountBalances.workspaceId],
			references: [workspaces.id],
		}),
		currentAccount: one(currentAccounts, {
			fields: [accountBalances.currentAccountId],
			references: [currentAccounts.id],
		}),
	}),
);

export const statementsRelations = relations(statements, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [statements.workspaceId],
		references: [workspaces.id],
	}),
	currentAccount: one(currentAccounts, {
		fields: [statements.currentAccountId],
		references: [currentAccounts.id],
	}),
	transactions: many(transactions),
}));

export const transactionsRelations = relations(
	transactions,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [transactions.workspaceId],
			references: [workspaces.id],
		}),
		currentAccount: one(currentAccounts, {
			fields: [transactions.currentAccountId],
			references: [currentAccounts.id],
		}),
		expenseCategory: one(expenseCategories, {
			fields: [transactions.expenseCategoryId],
			references: [expenseCategories.id],
		}),
		sourceStatement: one(statements, {
			fields: [transactions.sourceStatementId],
			references: [statements.id],
		}),
		splits: many(transactionSplits),
	}),
);

export const transactionSplitsRelations = relations(
	transactionSplits,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [transactionSplits.workspaceId],
			references: [workspaces.id],
		}),
		transaction: one(transactions, {
			fields: [transactionSplits.sourceTransactionId],
			references: [transactions.id],
		}), // Optional - will be null for standalone splits
		sourceAccount: one(currentAccounts, {
			fields: [transactionSplits.sourceAccountId],
			references: [currentAccounts.id],
		}), // For standalone splits - the account this split is from
		currentAccount: one(currentAccounts, {
			fields: [transactionSplits.currentAccountId],
			references: [currentAccounts.id],
		}),
	}),
);

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [timeEntries.workspaceId],
		references: [workspaces.id],
	}),
	user: one(users, {
		fields: [timeEntries.userId],
		references: [users.id],
	}),
}));
