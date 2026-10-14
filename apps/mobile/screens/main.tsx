import CategoryModal from "@/components/category-modal";
import ExpenseModal from "@/components/expense-modal";
import Button from "@/components/ui/button";
import ThemedText from "@/components/ui/themed-text";
import { TopBar, TopBarButton } from "@/components/ui/top-bar";
import { COLOR } from "@/constants/tokens";
import { getDefaultCategoryColor } from "@/constants/category-colors";
import { StorageKeyKind, storageRead, storageUpsert, subscribeStorage } from "@/data/storage";
import { googlePay, PaymentDraft } from "@/integrations/google-pay";
import { Category, Expense } from "@/types/entities";
import { Feather } from "@expo/vector-icons";
import { BlurTargetView, BlurView } from "expo-blur";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

function formatExpenseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function Main({ onSettings, onAnalytics, onDialogOpenChange }: {
  onSettings?: () => void;
  onAnalytics?: () => void;
  onDialogOpenChange?: (open: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const blurTarget = useRef<View>(null);
  const expenseSheet = useRef<View>(null);
  const sheetPosition = useRef(0);
  const dragStart = useRef(0);
  const listOffset = useRef(0);
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [overviewHeight, setOverviewHeight] = useState(0);
  const [categoryGridWidth, setCategoryGridWidth] = useState(0);
  const categoryColumns = 4;
  const categoryWidth = categoryGridWidth > 0
    ? (categoryGridWidth - (categoryColumns - 1) * 8) / categoryColumns
    : "23%" as const;
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [paymentDescription, setPaymentDescription] = useState<string>();
  const paymentUrl = Linking.useURL();
  const [ready, setReady] = useState(false);
  const savingRef = useRef(false);
  const [openedPaymentId, setOpenedPaymentId] = useState<string>();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  useEffect(() => {
    onDialogOpenChange?.(showExpenseModal || showCategoryModal);
  }, [onDialogOpenChange, showExpenseModal, showCategoryModal]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category>({
    id: uuid(),
    color: "rgb(255, 0, 0)",
    name: "",
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const sheetTravel = Math.max(0, Math.min(overviewHeight, viewportHeight - 100));
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => { sheetPosition.current = value; });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  const settleSheet = useCallback((expanded: boolean) => {
    setExpensesExpanded(false);
    Animated.spring(scrollY, {
      toValue: expanded ? sheetTravel : 0,
      stiffness: 260, damping: 28, mass: 1, overshootClamping: true,
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setExpensesExpanded(expanded); });
  }, [scrollY, sheetTravel]);

  // Gesture callbacks read the current animated position and list offset.
  // eslint-disable-next-line react-hooks/refs
  const sheetGesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (showExpenseModal || showCategoryModal || gesture.numberActiveTouches !== 1) return false;
      const vertical = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5;
      return vertical && (sheetPosition.current < sheetTravel - 1
        || (gesture.dy > 0 && listOffset.current <= 0));
    },
    onPanResponderGrant: () => {
      dragStart.current = sheetPosition.current;
      scrollY.stopAnimation((value) => { dragStart.current = value; });
      setExpensesExpanded(false);
    },
    onPanResponderMove: (_, gesture) => {
      scrollY.setValue(Math.max(0, Math.min(sheetTravel, dragStart.current - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const expanded = Math.abs(gesture.vy) > 0.5
        ? gesture.vy < 0 : sheetPosition.current > sheetTravel / 2;
      settleSheet(expanded);
    },
    onPanResponderTerminate: () => settleSheet(sheetPosition.current > sheetTravel / 2),
  }), [scrollY, settleSheet, sheetTravel, showExpenseModal, showCategoryModal]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = expenseSheet.current as unknown as HTMLElement | null;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (!expensesExpanded || (event.deltaY < 0 && listOffset.current <= 0)) {
        event.preventDefault();
        settleSheet(event.deltaY > 0);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [expensesExpanded, settleSheet]);

  const [expense, setExpense] = useState<Expense>({
    id: uuid(),
    amount: 0.0,
    date: new Date().toISOString(),
    categoryId: "0",
  });

  const showExpenseModalFunc = (categoryId: string) => {
    setEditingExpense(false);
    setPaymentDescription(undefined);
    setExpense({
      id: uuid(),
      amount: 0.0,
      date: new Date().toISOString(),
      categoryId,
    });
    setShowExpenseModal(true);
  };

  const reviewPayment = (payment: PaymentDraft) => {
    setEditingExpense(false);
    setPaymentDescription(payment.description);
    setExpense({
      id: uuid(), amount: payment.amount, date: payment.date,
      currency: payment.currency, sourcePaymentId: payment.id, categoryId: "",
    });
    setShowExpenseModal(true);
  };

  const editExpense = (expense: Expense) => {
    setEditingExpense(true);
    setPaymentDescription(undefined);
    setExpense(expense);
    setShowExpenseModal(true);
  };

  const saveExpense = async (expense: Expense) => {
    if (savingRef.current || !ready || !Number.isFinite(expense.amount) || expense.amount <= 0
      || !categories.some((category) => category.id === expense.categoryId)) return;
    savingRef.current = true;
    try {
      // Also protects against a stale reminder following a save or app restart.
      const stored = await storageRead<Expense[]>(StorageKeyKind.expenses);
      const duplicate = expense.sourcePaymentId && stored.some((item) => item.sourcePaymentId === expense.sourcePaymentId && item.id !== expense.id);
      if (!duplicate) await storageUpsert(StorageKeyKind.expenses, expense);
      setExpenses(await storageRead<Expense[]>(StorageKeyKind.expenses));
      if (expense.sourcePaymentId) {
        googlePay.dismiss(expense.sourcePaymentId);
        setPayments(googlePay.pending());
      }
      setShowExpenseModal(false);
    } catch {
      Alert.alert("Expense was not saved", "Please try again.");
    } finally { savingRef.current = false; }
  };

  const showCategoryModalFunc = () => {
    setCategory({
      id: uuid(),
      color: getDefaultCategoryColor(categories, category.color),
      name: "",
    });
    setShowCategoryModal(true);
  };

  const addCategory = async (category: Category) => {
    if (!ready || savingRef.current) return;
    savingRef.current = true;
    try {
      await storageUpsert(StorageKeyKind.categories, category);
      setCategories(await storageRead<Category[]>(StorageKeyKind.categories));
      setShowCategoryModal(false);
    } catch { Alert.alert("Category was not saved", "Please try again."); }
    finally { savingRef.current = false; }
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [categories, expenses] = await Promise.all([
          storageRead<Category[]>(StorageKeyKind.categories), storageRead<Expense[]>(StorageKeyKind.expenses),
        ]);
        if (cancelled) return;
        setCategories(categories);
        setExpenses(expenses);
        setReady(true);
      } catch { if (!cancelled) Alert.alert("Could not load your data", "Your stored data has been preserved. Restart the app to try again."); }
    };
    const unsubscribe = subscribeStorage(() => { void refresh(); });
    void refresh();
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    const refresh = () => {
      const pending = googlePay.pending();
      if (!ready) return;
      pending.filter((payment) => expenses.some((item) => item.sourcePaymentId === payment.id))
        .forEach((payment) => googlePay.dismiss(payment.id));
      setPayments(googlePay.pending());
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    // The native listener also runs while this screen is active.
    const timer = setInterval(refresh, 3000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [ready, expenses]);

  useEffect(() => {
    if (!ready || !paymentUrl) return;
    const id = Linking.parse(paymentUrl).queryParams?.paymentId;
    if (typeof id !== "string" || id === openedPaymentId) return;
    const payment = payments.find((item) => item.id === id);
    if (payment) {
      // Synchronize the form with an external Android notification deep link.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reviewPayment(payment);
      setOpenedPaymentId(id);
    }
  }, [ready, paymentUrl, payments, openedPaymentId]);

  const totals = expenses.reduce<Record<string, number>>((result, expense) => {
    const currency = expense.currency ?? "";
    result[currency] = (result[currency] ?? 0) + expense.amount;
    return result;
  }, {});

  return (
    <SafeAreaView style={styles.main} edges={["top"]}>
      <View style={styles.viewport}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {/* The overview has no vertical scroll surface. Only the expense sheet moves. */}
        <View style={styles.content}>
          {/* Fill the viewport without moving the initial expense list position. */}
          <BlurTargetView ref={blurTarget} style={{ minHeight: viewportHeight, backgroundColor: COLOR.bg }}>
            <View style={styles.overview}
              onLayout={(event) => setOverviewHeight(event.nativeEvent.layout.height)}>
              <TopBar actions={
                <>
                  <TopBarButton icon="bar-chart-2" label="Open analytics" onPress={onAnalytics} />
                  <TopBarButton icon="settings" label="Open settings" onPress={onSettings} />
                </>
              }>
                <ThemedText style={styles.brand}>FIN</ThemedText>
                <View style={styles.brandBadge}></View>
              </TopBar>
              <View style={styles.summary}>
                <View style={styles.sectionRow}>
                  <View style={styles.monthBadge}>
                    <View style={styles.statusDot} />
                    <ThemedText style={styles.smallLabel}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</ThemedText>
                  </View>
                </View>
                {(Object.entries(totals).length ? Object.entries(totals) : [["", 0]]).map(([currency, total]) => (
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
                    <Button style={{ flex: 1 }} onPress={() => reviewPayment(payment)}><ThemedText style={styles.buttonText}>Review payment</ThemedText></Button>
                    <Button style={styles.secondaryButton} onPress={() => {
                      googlePay.dismiss(payment.id);
                      setPayments(googlePay.pending());
                    }}><ThemedText style={styles.smallLabel}>Dismiss</ThemedText></Button>
                  </View>
                </View>
              ))}

              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
                </View>
                <View style={styles.categoryGrid} onLayout={(event) => setCategoryGridWidth(event.nativeEvent.layout.width)}>
                  {categories.map((el) => (
                    <Pressable key={el.id} accessibilityRole="button" accessibilityLabel={`Add expense to ${el.name}`}
                      onPress={() => showExpenseModalFunc(el.id)} style={({ pressed }) => [styles.category, { width: categoryWidth }, pressed && styles.categoryPressed]}>
                      <View style={styles.categoryMarker}>
                        <View style={[styles.categoryDot, { backgroundColor: el.color }]} />
                      </View>
                      <View style={styles.categoryLabel}>
                        <ThemedText style={styles.categoryName} numberOfLines={2}>{el.name}</ThemedText>
                      </View>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel="Create category" onPress={showCategoryModalFunc}
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
          </BlurTargetView>
          <AnimatedBlurView
            pointerEvents="none"
            blurTarget={blurTarget}
            blurMethod="dimezisBlurView"
            tint="dark"
            intensity={55}
            style={[
              StyleSheet.absoluteFill,
              { bottom: undefined, height: Math.max(viewportHeight, overviewHeight), opacity: scrollY.interpolate({
                inputRange: [0, 220],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }) },
            ]}
          />
        </View>
        <Animated.View ref={expenseSheet} testID="recent-expenses" {...sheetGesture.panHandlers}
          style={[styles.expenseSheet, { height: viewportHeight, transform: [{ translateY: Animated.subtract(sheetTravel, scrollY) }] }]}>
          <Animated.ScrollView scrollEnabled={expensesExpanded}
            showsVerticalScrollIndicator={false} scrollEventThrottle={16}
            onScroll={(event) => { listOffset.current = event.nativeEvent.contentOffset.y; }}>
            <View
              style={[styles.scrollingContent, { minHeight: viewportHeight, paddingBottom: 32 + insets.bottom }]}>
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
                    <ThemedText style={styles.emptyText}>Your expenses will appear here.
    Start with a category above.</ThemedText>
                  </View>
                ) : (
                  <View style={styles.expenseList}>
                    {expenses.toReversed().map((expense) => {
                      const category = categories.find((cat) => cat.id === expense.categoryId);
                      return (
                        <Pressable key={expense.id} accessibilityRole="button"
                          accessibilityLabel={`Edit ${category?.name ?? "Uncategorized"} expense, ${expense.currency ? `${expense.currency} ` : ""}${expense.amount.toFixed(2)}, ${formatExpenseDate(expense.date)}`}
                          onPress={() => editExpense(expense)}
                          style={({ pressed }) => [styles.expenseRow, pressed && styles.categoryPressed]}>
                          <View style={styles.expenseIcon}>
                            <View style={[styles.categoryDot, { backgroundColor: category?.color ?? COLOR.muted }]} />
                          </View>
                          <View style={styles.expenseDetail}>
                            <ThemedText style={styles.rowTitle} numberOfLines={1}>{category?.name ?? "Uncategorized"}</ThemedText>
                            <ThemedText style={styles.date}>{formatExpenseDate(expense.date)}</ThemedText>
                          </View>
                          <ThemedText style={styles.amount}>{expense.currency ? `${expense.currency} ` : ""}{expense.amount.toFixed(2)}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </Animated.ScrollView>
        </Animated.View>
      </View>
      <CategoryModal
        key={`${category.id}:${showCategoryModal}`}
        showModal={showCategoryModal}
        category={category}
        onClose={() => {
          setShowCategoryModal(false);
        }}
        onSave={addCategory}
      />
      <ExpenseModal
        key={`${expense.id}:${showExpenseModal}`}
        showModal={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
        }}
        expense={expense}
        categories={editingExpense || expense.sourcePaymentId ? categories : undefined}
        description={paymentDescription}
        editing={editingExpense}
        onSave={saveExpense}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: COLOR.bg },
  viewport: { flex: 1, overflow: "hidden" },
  content: { width: "100%", maxWidth: 600, alignSelf: "center" },
  expenseSheet: { position: "absolute", top: 0, width: "100%", maxWidth: 600, alignSelf: "center", zIndex: 1 },
  sheetHandle: { width: 32, height: 3, borderRadius: 2, backgroundColor: COLOR.muted, alignSelf: "center", marginBottom: 2 },
  overview: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 28, backgroundColor: COLOR.bg, zIndex: 0 },
  scrollingContent: { paddingHorizontal: 24, paddingBottom: 32, gap: 28, backgroundColor: "transparent", zIndex: 1 },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: -1 },
  brandBadge: { borderRadius: 4, backgroundColor: COLOR.surface, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { color: COLOR.muted, fontSize: 9, letterSpacing: 1 },
  intro: { gap: 10, marginTop: 8 },
  eyebrow: { color: COLOR.muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "500" },
  heading: { fontSize: 30, fontWeight: "600", letterSpacing: -1.2 },
  subtitle: { color: COLOR.muted, fontSize: 13, lineHeight: 20 },
  summary: { borderWidth: 1, borderColor: "#1B1B1B", borderRadius: 12, backgroundColor: "#0B0B0B", padding: 16, gap: 16 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  smallLabel: { fontSize: 12, color: COLOR.muted },
  monthBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLOR.muted },
  totalRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  total: { fontSize: 32, fontWeight: "400", color: "#C4C4C8", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  currency: { fontSize: 14, color: COLOR.muted },
  summaryFooter: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 14, flexDirection: "row", gap: 7, alignItems: "center" },
  section: { gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "500", letterSpacing: -0.3 },
  textButton: { minHeight: 32, flexDirection: "row", gap: 5, alignItems: "center" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  category: { minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 6, paddingVertical: 12, gap: 8, alignItems: "center", justifyContent: "center" },
  categoryPressed: { backgroundColor: COLOR.elevated, borderColor: COLOR.muted },
  categoryMarker: { width: 28, height: 28, borderRadius: 10, backgroundColor: COLOR.elevated, alignItems: "center", justifyContent: "center" },
  categoryLabel: { width: "100%", height: 30, justifyContent: "center" },
  categoryDot: { width: 8, height: 8, borderRadius: 3 },
  categoryName: { fontSize: 12, lineHeight: 15, fontWeight: "500", textAlign: "center" },
  newCategory: { borderStyle: "dashed", backgroundColor: "transparent" },
  count: { fontSize: 11, color: COLOR.muted, backgroundColor: COLOR.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  empty: { paddingVertical: 30, alignItems: "center", borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, gap: 12 },
  emptyIcon: { width: 40, height: 40, backgroundColor: COLOR.surface, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 3 },
  emptyText: { color: COLOR.muted, fontSize: 12, lineHeight: 20, textAlign: "center" },
  expenseList: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, overflow: "hidden" },
  expenseRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLOR.border },
  expenseIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLOR.elevated, alignItems: "center", justifyContent: "center" },
  expenseDetail: { flex: 1, gap: 5 },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  date: { fontSize: 10, color: COLOR.muted },
  amount: { fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "500" },
  payment: { backgroundColor: COLOR.surface, padding: 16, borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, gap: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  buttonText: { color: COLOR.onPrimary, fontWeight: "600", fontSize: 13 },
  secondaryButton: { backgroundColor: COLOR.elevated, borderWidth: 1, borderColor: COLOR.border },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  footerText: { color: COLOR.muted, fontSize: 10, letterSpacing: 0.3 },
});
