
export interface Category {
    id: string, name: string
}

export interface Expense {
    id: string,
    amount: number,
    date: string,
    categoryId: string
}