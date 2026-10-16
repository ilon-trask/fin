import CategoryModal from "@/components/category-modal";
import ExpenseModal from "@/components/expense-modal";
import { COLOR } from "@/constants/tokens";
import { getDefaultCategoryColor } from "@/constants/category-colors";
import { StorageKeyKind, storageRead, storageUpsert, subscribeStorage } from "@/data/storage";
import { googlePay, PaymentDraft } from "@/integrations/google-pay";
import { Category, Expense } from "@/types/entities";
import { BlurTargetView, BlurView } from "expo-blur";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { useExpenseSheet } from "@/hooks/use-expense-sheet";
import { MainOverview, RecentExpenses } from "@/components/main-sections";
import { styles } from "./main-styles";
import {
  Alert,
  Animated,
  AppState,
  StyleSheet,
  View,
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function Main({ onSettings, onAnalytics, onDialogOpenChange }: {
  onSettings?: () => void;
  onAnalytics?: () => void;
  onDialogOpenChange?: (open: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [overviewHeight, setOverviewHeight] = useState(0);
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

  const { scrollY, expenseSheet, listOffset, expensesExpanded, sheetTravel, sheetGesture } = useExpenseSheet(
    overviewHeight,
    viewportHeight,
    showExpenseModal || showCategoryModal,
  );

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

  return (
    <SafeAreaView style={styles.main} edges={["top"]}>
      <View style={styles.viewport}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        {/* The overview has no vertical scroll surface. Only the expense sheet moves. */}
        <View style={styles.content}>
          {/* Fill the viewport without moving the initial expense list position. */}
          <BlurTargetView ref={blurTarget} style={{ minHeight: viewportHeight, backgroundColor: COLOR.bg }}>
            <MainOverview
              categories={categories}
              expenses={expenses}
              payments={payments}
              onHeightChange={setOverviewHeight}
              onAnalytics={onAnalytics}
              onSettings={onSettings}
              onNewExpense={showExpenseModalFunc}
              onNewCategory={showCategoryModalFunc}
              onReviewPayment={reviewPayment}
              onDismissPayment={(id) => {
                googlePay.dismiss(id);
                setPayments(googlePay.pending());
              }}
            />
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
              <RecentExpenses expenses={expenses} categories={categories} onEdit={editExpense} />
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
