import { accountsRouter } from "grandeo/server/api/routers/accounts";
import { expenseCategoriesRouter } from "grandeo/server/api/routers/expense-categories";
import { recurringExpensesRouter } from "grandeo/server/api/routers/recurring-expenses";
import { statementImportsRouter } from "grandeo/server/api/routers/statement-imports";
import { statementsRouter } from "grandeo/server/api/routers/statements";
import { timeTrackingRouter } from "grandeo/server/api/routers/time-tracking";
import { transactionsRouter } from "grandeo/server/api/routers/transactions";
import { usersRouter } from "grandeo/server/api/routers/users";
import { workspacesRouter } from "grandeo/server/api/routers/workspaces";
import { createCallerFactory, createTRPCRouter } from "grandeo/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	users: usersRouter,
	workspaces: workspacesRouter,
	expenseCategories: expenseCategoriesRouter,
	currentAccounts: accountsRouter,
	recurringExpenses: recurringExpensesRouter,
	statements: statementsRouter,
	statementImports: statementImportsRouter,
	transactions: transactionsRouter,
	timeTracking: timeTrackingRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
