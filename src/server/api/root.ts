import { accountsRouter } from "grandeo/server/api/routers/accounts";
import { expenseCategoriesRouter } from "grandeo/server/api/routers/expense-categories";
import { recurringExpensesRouter } from "grandeo/server/api/routers/recurring-expenses";
import { statementsRouter } from "grandeo/server/api/routers/statements";
import { transactionsRouter } from "grandeo/server/api/routers/transactions";
import { createCallerFactory, createTRPCRouter } from "grandeo/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	expenseCategories: expenseCategoriesRouter,
	currentAccounts: accountsRouter,
	recurringExpenses: recurringExpensesRouter,
	statements: statementsRouter,
	transactions: transactionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
