export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  amount: number;
  date: string;
  categoryId: string;
  currency?: string;
  sourcePaymentId?: string;
}
