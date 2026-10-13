import type { z } from "zod";
import type { categorySchema, expenseSchema } from "@fin/shared";

export type Category = z.infer<typeof categorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
