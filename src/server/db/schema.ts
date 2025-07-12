import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `grandeo_${name}`);

export const users = createTable("user", (d) => ({
	id: d
		.text({ length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: d.text({ length: 255 }),
	email: d.text({ length: 255 }).notNull(),
	emailVerified: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	image: d.text({ length: 255 }),
}));

export const accounts = createTable(
	"account",
	(d) => ({
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.text({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.text({ length: 255 }).notNull(),
		providerAccountId: d.text({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.integer(),
		token_type: d.text({ length: 255 }),
		scope: d.text({ length: 255 }),
		id_token: d.text(),
		session_state: d.text({ length: 255 }),
	}),
	(t) => [
		primaryKey({
			columns: [t.provider, t.providerAccountId],
		}),
		index("account_user_id_idx").on(t.userId),
	],
);

export const sessions = createTable(
	"session",
	(d) => ({
		sessionToken: d.text({ length: 255 }).notNull().primaryKey(),
		userId: d
			.text({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.integer({ mode: "timestamp" }).notNull(),
	}),
	(t) => [index("session_userId_idx").on(t.userId)],
);

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

export const recordedAccountBalances = createTable(
	"recorded_account_balance",
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
		amountInPounds: d.real().notNull(),
		date: d.integer({ mode: "timestamp" }).notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("recorded_balance_account_idx").on(t.currentAccountId),
		index("recorded_balance_date_idx").on(t.date),
		index("recorded_balance_account_date_idx").on(t.currentAccountId, t.date),
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
		statementDate: d.integer({ mode: "timestamp" }).notNull(),
		periodStartDate: d.integer({ mode: "timestamp" }).notNull(),
		periodEndDate: d.integer({ mode: "timestamp" }).notNull(),
		openingBalance: d.real().notNull(),
		closingBalance: d.real().notNull(),
		createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
		updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
	}),
	(t) => [
		index("statement_account_idx").on(t.currentAccountId),
		index("statement_date_idx").on(t.statementDate),
		index("statement_period_idx").on(t.periodStartDate, t.periodEndDate),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	currentAccounts: many(currentAccounts),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

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
	}),
);

export const currentAccountsRelations = relations(
	currentAccounts,
	({ many }) => ({
		recurringExpenses: many(recurringExpenses),
		recordedAccountBalances: many(recordedAccountBalances),
		statements: many(statements),
	}),
);

export const recordedAccountBalancesRelations = relations(
	recordedAccountBalances,
	({ one }) => ({
		currentAccount: one(currentAccounts, {
			fields: [recordedAccountBalances.currentAccountId],
			references: [currentAccounts.id],
		}),
	}),
);

export const statementsRelations = relations(statements, ({ one }) => ({
	currentAccount: one(currentAccounts, {
		fields: [statements.currentAccountId],
		references: [currentAccounts.id],
	}),
}));
