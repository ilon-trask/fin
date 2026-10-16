import ThemedText from "@/components/ui/themed-text";
import { TopBar, TopBarButton } from "@/components/ui/top-bar";
import { COLOR } from "@/constants/tokens";
import { StorageKeyKind, storageRead, subscribeStorage } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { addDays, startOfWeek, weekLabel } from "@/utils/analytics-period";
import { buildAnalyticsSummary, type AnalyticsPeriod } from "@/utils/analytics-summary";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Analytics({ active, onBack }: { active: boolean; onBack: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(new Date()));
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [savedExpenses, savedCategories] = await Promise.all([
          storageRead<Expense[]>(StorageKeyKind.expenses),
          storageRead<Category[]>(StorageKeyKind.categories),
        ]);
        if (cancelled) return;
        setExpenses(savedExpenses.filter((item) => Number.isFinite(item.amount) && item.amount > 0));
        setCategories(savedCategories);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const unsubscribe = subscribeStorage(() => { void refresh(); });
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { cancelled = true; unsubscribe(); subscription.remove(); };
  }, [active]);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const currencies = useMemo(() => [...new Set(expenses.map((item) => item.currency ?? ""))], [expenses]);
  const selectedCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? "");
  const money = (amount: number) => `${selectedCurrency ? `${selectedCurrency} ` : ""}${amount.toFixed(2)}`;
  const now = new Date();
  const monthLabel = selectedMonth.toLocaleString("default", { month: "long", year: "numeric" });
  const isCurrentMonth = selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() === now.getMonth();
  const isCurrentWeek = selectedWeek.getTime() === startOfWeek(now).getTime();
  const isCurrentPeriod = period === "week" ? isCurrentWeek : isCurrentMonth;
  const periodLabel = period === "week" ? weekLabel(selectedWeek) : period === "month" ? monthLabel : "All time";
  const changePeriod = (offset: number) => {
    if (period === "week") setSelectedWeek(addDays(selectedWeek, offset * 7));
    else setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset, 1));
    setPeriodPickerOpen(false);
  };
  const { count, total, breakdown, trend } = useMemo(
    () => buildAnalyticsSummary(expenses, selectedCurrency, period, selectedWeek, selectedMonth, new Date()),
    [expenses, selectedCurrency, period, selectedWeek, selectedMonth],
  );
  const maxTrend = Math.max(...trend.map((item) => item.amount), 1);
  const trendCaption = period === "week"
    ? (isCurrentWeek ? "Last 6 weeks" : `6 weeks ending ${weekLabel(selectedWeek)}`)
    : period === "month" && !isCurrentMonth ? `6 months ending ${monthLabel}` : "Last 6 months";

  return (
    <SafeAreaView style={styles.main} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar actions={<TopBarButton icon="arrow-right" label="Back to expenses" onPress={onBack} />}>
          <ThemedText style={styles.heading}>Analytics</ThemedText>
        </TopBar>
        <View style={styles.periodControl}>
          <View style={styles.periodRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Choose time period, ${periodLabel}`}
              accessibilityState={{ expanded: periodPickerOpen }} onPress={() => setPeriodPickerOpen(!periodPickerOpen)}
              style={({ pressed }) => [styles.periodTrigger, pressed && styles.pressed]}>
              <View style={styles.calendarIcon}><Feather name={period === "all" ? "clock" : "calendar"} size={18} color={COLOR.muted} /></View>
              <View style={styles.periodLabel}>
                <ThemedText style={styles.periodCaption}>{period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Time period"}</ThemedText>
                <ThemedText style={styles.periodText}>{periodLabel}</ThemedText>
              </View>
              <Feather name={periodPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={COLOR.muted} />
            </Pressable>
            {period !== "all" && (
              <View style={styles.monthNavigation}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${period}`} onPress={() => changePeriod(-1)}
                  style={({ pressed }) => [styles.monthArrow, pressed && styles.pressed]}>
                  <Feather name="chevron-left" size={18} color={COLOR.text} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Next ${period}`} disabled={isCurrentPeriod}
                  accessibilityState={{ disabled: isCurrentPeriod }} onPress={() => changePeriod(1)}
                  style={({ pressed }) => [styles.monthArrow, isCurrentPeriod && styles.disabled, pressed && styles.pressed]}>
                  <Feather name="chevron-right" size={18} color={COLOR.text} />
                </Pressable>
              </View>
            )}
          </View>
          {periodPickerOpen && (
            <View style={styles.periodOptions}>
              {(["week", "month", "all"] as const).map((value) => {
                const selected = period === value && (value === "all" || isCurrentPeriod);
                const label = value === "week" ? "This week" : value === "month" ? "This month" : "All time";
                return (
                  <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }}
                    onPress={() => {
                      setPeriod(value);
                      if (value === "month") setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      if (value === "week") setSelectedWeek(startOfWeek(now));
                      setPeriodPickerOpen(false);
                    }} style={({ pressed }) => [styles.periodOption, selected && styles.activePeriodOption, pressed && styles.pressed]}>
                    <Feather name={value === "all" ? "clock" : "calendar"} size={16} color={COLOR.muted} />
                    <ThemedText style={styles.periodOptionText}>{label}</ThemedText>
                    {selected && <Feather name="check" size={16} color={COLOR.text} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        {currencies.length > 1 && (
          <View style={styles.currencies}>
            {currencies.map((value) => (
              <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selectedCurrency === value }}
                onPress={() => setCurrency(value)} style={[styles.currency, selectedCurrency === value && styles.selectedFilter]}>
                <ThemedText style={[styles.filterText, selectedCurrency === value && styles.selectedText]}>{value || "No currency"}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}
        {loading || failed ? (
          <View style={styles.empty}><ThemedText style={styles.description}>{failed ? "Could not load analytics. Reopen this screen to try again." : "Loading your expenses…"}</ThemedText></View>
        ) : (
          <>
            <View style={styles.card}>
              <ThemedText style={styles.description}>Total spent · {periodLabel}</ThemedText>
              <ThemedText style={styles.total} adjustsFontSizeToFit numberOfLines={1}>{money(total)}</ThemedText>
              <View style={styles.stats}>
                <View style={styles.stat}><ThemedText style={styles.statValue}>{count}</ThemedText><ThemedText style={styles.caption}>Expenses</ThemedText></View>
                <View style={styles.stat}><ThemedText style={styles.statValue}>{money(count ? total / count : 0)}</ThemedText><ThemedText style={styles.caption}>Average expense</ThemedText></View>
              </View>
            </View>
            <View style={styles.card}>
              <ThemedText style={styles.title}>Spending trend</ThemedText>
              <ThemedText style={styles.caption}>{trendCaption}{selectedCurrency ? ` · ${selectedCurrency}` : ""}</ThemedText>
              <View style={styles.chart}>
                {trend.map((item, index) => (
                  <View key={index} style={styles.column} accessible accessibilityLabel={`${item.accessibleLabel}: ${money(item.amount)}`}>
                    <ThemedText style={styles.chartValue} numberOfLines={1} adjustsFontSizeToFit>{item.amount.toFixed(2)}</ThemedText>
                    <View style={styles.barTrack}><View style={[styles.bar, { height: item.amount ? Math.max(3, item.amount / maxTrend * 100) : 2, backgroundColor: index === 5 ? COLOR.primary : COLOR.secondary }]} /></View>
                    <ThemedText style={styles.caption}>{item.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <ThemedText style={styles.title}>By category</ThemedText>
              {breakdown.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="pie-chart" size={24} color={COLOR.muted} />
                  <ThemedText>No spending {period === "all" ? "yet" : isCurrentPeriod ? `this ${period}` : "in this period"}.</ThemedText>
                  <ThemedText style={styles.description}>Add expenses to see your category breakdown.</ThemedText>
                </View>
              ) : (
                <View style={styles.card}>
                  {breakdown.map(([id, amount]) => {
                    const category = categoriesById.get(id);
                    const share = amount / total * 100;
                    return (
                      <View key={id} style={styles.category}>
                        <View style={styles.categoryRow}>
                          <View style={[styles.dot, { backgroundColor: category?.color ?? COLOR.muted }]} />
                          <ThemedText style={styles.categoryName} numberOfLines={1}>{category?.name ?? "Uncategorized"}</ThemedText>
                          <ThemedText style={styles.categoryAmount}>{money(amount)}</ThemedText>
                          <ThemedText style={styles.caption}>{Math.round(share)}%</ThemedText>
                        </View>
                        <View style={styles.categoryTrack}><View style={{ width: `${share}%`, height: 4, borderRadius: 2, backgroundColor: category?.color ?? COLOR.muted }} /></View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: COLOR.bg },
  content: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 28 },
  heading: { fontSize: 22, fontWeight: "600", letterSpacing: -0.7 },
  description: { fontSize: 13, lineHeight: 20, color: COLOR.muted },
  periodControl: { backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border, borderRadius: 12, padding: 8 },
  periodRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  periodTrigger: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 8, borderRadius: 8 },
  calendarIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  periodLabel: { flex: 1, gap: 4 },
  periodCaption: { fontSize: 10, color: COLOR.muted },
  periodText: { fontSize: 14, fontWeight: "500", letterSpacing: -0.2 },
  monthNavigation: { flexDirection: "row", borderLeftWidth: 1, borderLeftColor: COLOR.border, paddingLeft: 8 },
  monthArrow: { width: 40, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  pressed: { backgroundColor: COLOR.elevated },
  disabled: { opacity: 0.25 },
  periodOptions: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 8, marginTop: 8, gap: 4 },
  periodOption: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 16, borderRadius: 8 },
  activePeriodOption: { backgroundColor: COLOR.elevated },
  periodOptionText: { flex: 1, fontSize: 13 },
  selectedFilter: { backgroundColor: COLOR.primary },
  filterText: { fontSize: 12, color: COLOR.muted },
  selectedText: { color: COLOR.onPrimary, fontWeight: "600" },
  currencies: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  currency: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLOR.border, borderRadius: 6 },
  card: { backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border, borderRadius: 12, padding: 20, gap: 16 },
  total: { fontSize: 38, letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", gap: 20, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 16 },
  stat: { flex: 1, gap: 6 },
  statValue: { fontSize: 16, fontVariant: ["tabular-nums"] },
  caption: { fontSize: 10, color: COLOR.muted },
  title: { fontSize: 16, fontWeight: "500", letterSpacing: -0.3 },
  chart: { flexDirection: "row", gap: 10, marginTop: 6 },
  column: { flex: 1, gap: 10, alignItems: "center" },
  chartValue: { fontSize: 9, color: COLOR.muted, fontVariant: ["tabular-nums"] },
  barTrack: { height: 100, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3 },
  section: { gap: 14 },
  empty: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, padding: 24, alignItems: "center", gap: 14 },
  category: { gap: 10 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  categoryName: { flex: 1, fontSize: 12 },
  categoryAmount: { fontSize: 12, fontVariant: ["tabular-nums"] },
  categoryTrack: { height: 4, backgroundColor: COLOR.elevated, borderRadius: 2, overflow: "hidden" },
});
