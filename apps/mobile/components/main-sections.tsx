import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLOR } from "@/constants/tokens";
import type { PaymentDraft } from "@/integrations/google-pay";
import type { Category, Expense } from "@/types/entities";
import { styles } from "@/screens/main-styles";
import Button from "./ui/button";
import ThemedText from "./ui/themed-text";
import { TopBar, TopBarButton } from "./ui/top-bar";

const CATEGORY_COLUMNS = 4;
const CATEGORY_GAP = 8;

function formatExpenseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

type OverviewProps = {
  categories: Category[];
  expenses: Expense[];
  payments: PaymentDraft[];
  onHeightChange: (height: number) => void;
  onAnalytics?: () => void;
  onSettings?: () => void;
  onNewExpense: (categoryId: string) => void;
  onNewCategory: () => void;
  onReviewPayment: (payment: PaymentDraft) => void;
  onDismissPayment: (id: string) => void;
};

export function MainOverview({
  categories, expenses, payments, onHeightChange, onAnalytics, onSettings,
  onNewExpense, onNewCategory, onReviewPayment, onDismissPayment,
}: OverviewProps) {
  const [gridWidth, setGridWidth] = useState(0);
  const categoryWidth = gridWidth > 0
    ? (gridWidth - (CATEGORY_COLUMNS - 1) * CATEGORY_GAP) / CATEGORY_COLUMNS
    : "23%" as const;
  const totals = useMemo(() => expenses.reduce<Record<string, number>>((result, expense) => {
    const currency = expense.currency ?? "";
    result[currency] = (result[currency] ?? 0) + expense.amount;
    return result;
  }, Object.create(null)), [expenses]);
  const totalEntries = Object.entries(totals);

  return (
    <View style={styles.overview} onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}>
      <TopBar actions={<>
        <TopBarButton icon="bar-chart-2" label="Open analytics" onPress={onAnalytics} />
        <TopBarButton icon="settings" label="Open settings" onPress={onSettings} />
      </>}>
        <ThemedText style={styles.brand}>FIN</ThemedText>
        <View style={styles.brandBadge} />
      </TopBar>

      <View style={styles.summary}>
        <View style={styles.sectionRow}>
          <View style={styles.monthBadge}>
            <View style={styles.statusDot} />
            <ThemedText style={styles.smallLabel}>
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </ThemedText>
          </View>
        </View>
        {(totalEntries.length ? totalEntries : [["", 0]]).map(([currency, total]) => (
          <View key={currency} style={styles.totalRow}>
            {!!currency && <ThemedText style={styles.currency}>{currency}</ThemedText>}
            <ThemedText style={styles.total}>{Number(total).toFixed(2)}</ThemedText>
          </View>
        ))}
      </View>

      {payments.map((payment) => (
        <View key={payment.id} style={styles.payment}>
          <View style={styles.sectionRow}>
            <ThemedText style={styles.rowTitle}>Google Pay</ThemedText>
            <ThemedText>{payment.currency} {payment.amount.toFixed(2)}</ThemedText>
          </View>
          <ThemedText style={styles.subtitle}>{payment.description}</ThemedText>
          <View style={styles.actionRow}>
            <Button style={{ flex: 1 }} onPress={() => onReviewPayment(payment)}>
              <ThemedText style={styles.buttonText}>Review payment</ThemedText>
            </Button>
            <Button style={styles.secondaryButton} onPress={() => onDismissPayment(payment.id)}>
              <ThemedText style={styles.smallLabel}>Dismiss</ThemedText>
            </Button>
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
        </View>
        <View style={styles.categoryGrid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
          {categories.map((category) => (
            <Pressable key={category.id} accessibilityRole="button"
              accessibilityLabel={`Add expense to ${category.name}`}
              onPress={() => onNewExpense(category.id)}
              style={({ pressed }) => [styles.category, { width: categoryWidth }, pressed && styles.categoryPressed]}>
              <View style={styles.categoryMarker}>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              </View>
              <View style={styles.categoryLabel}>
                <ThemedText style={styles.categoryName} numberOfLines={2}>{category.name}</ThemedText>
              </View>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Create category"
            onPress={onNewCategory}
            style={({ pressed }) => [styles.category, styles.newCategory, { width: categoryWidth }, pressed && styles.categoryPressed]}>
            <View style={styles.categoryMarker}>
              <Feather name="plus" size={16} color={COLOR.muted} />
            </View>
            <View style={styles.categoryLabel}>
              <ThemedText style={[styles.categoryName, { color: COLOR.muted }]}>New</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type RecentExpensesProps = {
  expenses: Expense[];
  categories: Category[];
  onEdit: (expense: Expense) => void;
};

export function RecentExpenses({ expenses, categories, onEdit }: RecentExpensesProps) {
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const expenseGroups = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    const sortedExpenses = [...expenses].sort((a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    for (const expense of sortedExpenses) {
      const date = formatExpenseDate(expense.date);
      const group = groups.get(date);
      if (group) group.push(expense);
      else groups.set(date, [expense]);
    }
    return Array.from(groups, ([date, items]) => ({ date, items }));
  }, [expenses]);

  return (
    <View style={styles.section}>
      <View style={styles.sheetHandle} />
      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionTitle}>Recent expenses</ThemedText>
        <ThemedText style={styles.count}>{expenses.length}</ThemedText>
      </View>
      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Feather name="list" size={20} color={COLOR.muted} /></View>
          <ThemedText style={styles.rowTitle}>A fresh start.</ThemedText>
          <ThemedText style={styles.emptyText}>
            Your expenses will appear here. Start with a category above.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.expenseGroups}>
          {expenseGroups.map(({ date, items }) => (
            <View key={date} style={styles.expenseGroup}>
              <ThemedText accessibilityRole="header" style={styles.expenseDate}>{date}</ThemedText>
              <View style={styles.expenseList}>
                {items.map((expense) => {
                  const category = categoriesById.get(expense.categoryId);
                  const categoryName = category?.name ?? "Uncategorized";
                  const amount = `${expense.currency ? `${expense.currency} ` : ""}${expense.amount.toFixed(2)}`;
                  return (
                    <Pressable key={expense.id} accessibilityRole="button"
                      accessibilityLabel={`Edit ${categoryName} expense, ${amount}, ${date}`}
                      onPress={() => onEdit(expense)}
                      style={({ pressed }) => [styles.expenseRow, pressed && styles.categoryPressed]}>
                      <View style={styles.expenseIcon}>
                        <View style={[styles.categoryDot, { backgroundColor: category?.color ?? COLOR.muted }]} />
                      </View>
                      <View style={styles.expenseDetail}>
                        <ThemedText style={styles.rowTitle} numberOfLines={1}>{categoryName}</ThemedText>
                      </View>
                      <ThemedText style={styles.amount}>{amount}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
