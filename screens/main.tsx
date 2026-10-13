import Button from "@/components/ui/button";
import { googlePay, PaymentDraft } from "@/integrations/google-pay";
import * as Linking from "expo-linking";
import CategoryModal from "@/components/category-modal";
import ExpenseModal from "@/components/expense-modal";
import ThemedText from "@/components/ui/themed-text";
import { COLOR, SIZE } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSaveRaw } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    AppState,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

function formatExpenseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function Main() {
  const { height } = Dimensions.get("window");
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [paymentDescription, setPaymentDescription] = useState<string>();
  const paymentUrl = Linking.useURL();
  const [ready, setReady] = useState(false);
  const savingRef = useRef(false);
  const [openedPaymentId, setOpenedPaymentId] = useState<string>();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([
    { id: "1", color: "rgb(43, 255, 0)", name: "food" },
    { id: "2", color: "rgb(255, 187, 0)", name: "clodth" },
    { id: "3", color: "rgb(0, 149, 255)", name: "dönner" },
    { id: "4", color: "rgb(0, 42, 255)", name: "electronics" },
  ]);
  const [category, setCategory] = useState<Category>({
    id: uuid(),
    color: "rgb(255, 0, 0)",
    name: "",
  });
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: "1",
      amount: 8.0,
      categoryId: "3",
      date: "18/05/2026, 01:06:33",
    },
  ]);

  const [expense, setExpense] = useState<Expense>({
    id: uuid(),
    amount: 0.0,
    date: new Date().toISOString(),
    categoryId: "0",
  });

  const showExpenseModalFunc = (categoryId: string) => {
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
    setPaymentDescription(payment.description);
    setExpense({
      id: uuid(), amount: payment.amount, date: payment.date,
      currency: payment.currency, sourcePaymentId: payment.id, categoryId: "",
    });
    setShowExpenseModal(true);
  };

  const addExpense = async (expense: Expense) => {
    if (savingRef.current || !ready || !Number.isFinite(expense.amount) || expense.amount <= 0
      || !categories.some((category) => category.id === expense.categoryId)) return;
    savingRef.current = true;
    try {
      // Also protects against a stale reminder following a save or app restart.
      const stored = await storageRead<Expense[]>(StorageKeyKind.expenses);
      const duplicate = expense.sourcePaymentId && stored.some((item) => item.sourcePaymentId === expense.sourcePaymentId);
      const data = duplicate ? stored : [...stored, expense];
      await storageSaveRaw(StorageKeyKind.expenses, JSON.stringify(data));
      setExpenses(data);
      if (expense.sourcePaymentId) {
        googlePay.dismiss(expense.sourcePaymentId);
        setPayments(googlePay.pending());
      }
      setShowExpenseModal(false);
    } catch {
      Alert.alert("Payment was not saved", "Please try again.");
    } finally { savingRef.current = false; }
  };

  const showCategoryModalFunc = () => {
    setCategory({
      id: uuid(),
      color: "rgb(255,0,0)",
      name: "",
    });
    setShowCategoryModal(true);
  };

  const addCategory = (category: Category) => {
    setCategories((prev) => {
      const data = [...prev, category];
      storageSaveRaw(StorageKeyKind.categories, JSON.stringify(data));
      return data;
    });
    setShowCategoryModal(false);
  };

  useEffect(() => {
    (async () => {
      const categories = await storageRead<Category[]>(
        StorageKeyKind.categories,
      );
      const expenses = await storageRead<Expense[]>(StorageKeyKind.expenses);

      setCategories(categories);
      setExpenses(expenses);
      setReady(true);
    })();
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
    <SafeAreaView style={styles.main}>
      <ScrollView style={{ width: "100%" }}>
        {payments.map((payment) => (
          <View key={payment.id} style={{ padding: 12, gap: 8, marginBottom: 12, backgroundColor: COLOR.surface }}>
            <ThemedText>Google Pay · {payment.currency} {payment.amount.toFixed(2)}</ThemedText>
            <ThemedText>{payment.description}</ThemedText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button onPress={() => reviewPayment(payment)}><ThemedText>Add payment</ThemedText></Button>
              <Button onPress={() => {
                googlePay.dismiss(payment.id);
                setPayments(googlePay.pending());
              }}><ThemedText>Dismiss</ThemedText></Button>
            </View>
          </View>
        ))}
        <View style={{ height: height * 0.4 }}>
          <View style={{ alignSelf: "flex-end" }}>
            <View>
              <ThemedText style={{ fontSize: 24 }}>
                {new Date().toLocaleString("default", { month: "long" })}
              </ThemedText>
              {(Object.entries(totals).length ? Object.entries(totals) : [["", 0]]).map(([currency, total]) => (
                <ThemedText key={currency} style={{ fontSize: 48 }}>
                  {currency} {Number(total).toFixed(2)}
                </ThemedText>
              ))}
            </View>
          </View>

          <ThemedText>Categories:</ThemedText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {categories.map((el) => (
              <Pressable
                key={el.id}
                onPress={() => showExpenseModalFunc(el.id)}
                style={{
                  width: SIZE["64"],
                  height: SIZE["64"],
                  borderWidth: 2,
                  borderColor: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <ThemedText>{el.name}</ThemedText>
              </Pressable>
            ))}
            <Pressable
              onPress={showCategoryModalFunc}
              style={{
                width: SIZE["64"],
                height: SIZE["64"],
                borderWidth: 2,
                borderColor: "rgba(255, 255, 255, 0.7)",
              }}
            >
              <ThemedText>add category</ThemedText>
            </Pressable>
          </View>
        </View>
        <View style={{ width: "100%", gap: 8 }}>
          {expenses.toReversed().map((expense) => {
            const category = categories.find(
              (cat) => cat.id === expense.categoryId,
            );


            return (
              <View
                key={expense.id}
                style={{
                  borderColor: "white",
                  borderWidth: 1,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    alignItems: "center",
                  }}
                >
                  <ThemedText style={{}}>I</ThemedText>
                </View>
                <View style={{ flex: 1, marginStart: 8 }}>
                  <ThemedText style={{ fontSize: 18 }}>
                    {category?.name ?? "Uncategorized"}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 10 }}>
                    {formatExpenseDate(expense.date)}
                  </ThemedText>
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                  }}
                >
                  <ThemedText>{expense.currency} {expense.amount}</ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <CategoryModal
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
        categories={expense.sourcePaymentId ? categories : undefined}
        description={paymentDescription}
        onSave={addExpense}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    padding: 10,
    flex: 1,
    backgroundColor: COLOR.bg,
  },
});
