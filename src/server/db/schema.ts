import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `grandeo_${name}`);

export const verificationTokens = createTable(
	"verification_token",
	(d) => ({
		identifier: d.text({ length: 255 }).notNull(),
		token: d.text({ length: 255 }).notNull(),
		expires: d.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const currentAccounts = createTable(
	"current_account",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: d.text({ length: 255 }).notNull().unique(),
		accountType: d.text({ length: 50 }).notNull().default("current_account"), // 'current_account' or 'credit_card'
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("current_account_name_idx").on(t.name),
		index("current_account_type_idx").on(t.accountType),
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
		name: d.text({ length: 255 }).notNull().unique(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [index("expense_category_name_idx").on(t.name)],
);

export const recurringExpenses = createTable(
	"recurring_expense",
	(d) => ({
		id: d
			.text({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
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
		index("transaction_split_source_transaction_idx").on(t.sourceTransactionId),
		index("transaction_split_source_account_idx").on(t.sourceAccountId),
		index("transaction_split_account_idx").on(t.currentAccountId),
	],
);

export const recurringExpensesRelations = relations(
	recurringExpenses,
	({ one }) => ({
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
	({ many }) => ({
		recurringExpenses: many(recurringExpenses),
		transactions: many(transactions),
	}),
);

export const currentAccountsRelations = relations(
	currentAccounts,
	({ many }) => ({
		recurringExpenses: many(recurringExpenses),
		accountBalances: many(accountBalances),
		statements: many(statements),
		transactions: many(transactions),
	}),
);

export const accountBalancesRelations = relations(
	accountBalances,
	({ one }) => ({
		currentAccount: one(currentAccounts, {
			fields: [accountBalances.currentAccountId],
			references: [currentAccounts.id],
		}),
	}),
);

export const statementsRelations = relations(statements, ({ one, many }) => ({
	currentAccount: one(currentAccounts, {
		fields: [statements.currentAccountId],
		references: [currentAccounts.id],
	}),
	transactions: many(transactions),
}));

export const transactionsRelations = relations(
	transactions,
	({ one, many }) => ({
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
