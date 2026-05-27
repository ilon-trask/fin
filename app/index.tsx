import CategoryModal from "@/components/category-modal";
import ExpenseModal from "@/components/expense-modal";
import Button from "@/components/ui/button";
import ThemedText from "@/components/ui/themed-text";
import { SIZE } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSave } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { useEffect, useState } from "react";
import {
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

export default function Index() {
  const { height } = Dimensions.get("window");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([
    { id: "1", name: "food" },
    { id: "2", name: "clodth" },
    { id: "3", name: "dönner" },
    { id: "4", name: "electronics" },
  ]);
  const [category, setCategory] = useState<Category>({
    id: uuid(),
    name: "",
  });
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: "1", amount: 8.0, categoryId: "3", date: "18/05/2026, 01:06:33" },
  ]);

  const [expense, setExpense] = useState<Expense>({
    id: uuid(),
    amount: 0.0,
    date: new Date().toISOString(),
    categoryId: "0",
  });

  const showExpenseModalFunc = (categoryId: string) => {
    setExpense({
      id: uuid(),
      amount: 0.0,
      date: new Date().toISOString(),
      categoryId,
    });
    setShowExpenseModal(true);
  };

  const addExpense = (expense: Expense) => {
    setExpenses((prev) => {
      const data = [...prev, expense];
      storageSave(StorageKeyKind.expenses, JSON.stringify(data));
      return data;
    });
    setShowExpenseModal(false);
  };

  const showCategoryModalFunc = () => {
    setCategory({
      id: uuid(),
      name: "",
    });
    setShowCategoryModal(true);
  };

  const addCategory = (category: Category) => {
    setCategories((prev) => {
      const data = [...prev, category];
      storageSave(StorageKeyKind.categories, JSON.stringify(data));
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
    })();
  }, []);

  async function exportData() {
    const categories = await storageRead<Category[]>(StorageKeyKind.categories);
    const expenses = await storageRead<Expense[]>(StorageKeyKind.expenses);

    return expenses.map((exp) => {
      const category = categories.find((el) => el.id === exp.categoryId);
      let categoryName = "notFound";
      if (category) {
        categoryName = category.name;
      }

      const { categoryId, ...rest } = exp;
      return { ...rest, category: categoryName };
    });
  }

  type ExpenseData = Omit<Expense, "categoryId"> & { category: string };

  async function importData(rawData: string) {
    const data: ExpenseData[] = JSON.parse(rawData);
    const categories: Category[] = [];
    const expenses: Expense[] = [];
    data.forEach((exp) => {
      /* eslint-disable */
      let categoryId = categories.find(
        (category) => category.name === exp.category,
      )?.id;
      /* eslint-enable */
      if (!categoryId) {
        categoryId = uuid();
        categories.push({ id: categoryId, name: exp.category });
      }

      const { category, ...rest } = exp;
      expenses.push({ ...rest, categoryId });
    });
    storageSave(StorageKeyKind.categories, JSON.stringify(categories));
    storageSave(StorageKeyKind.expenses, JSON.stringify(expenses));
    return expenses;
  }

  return (
    <SafeAreaView style={styles.main}>
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={{
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Button>
            <ThemedText>Import</ThemedText>
          </Button>
          <Button>
            <ThemedText>Export</ThemedText>
          </Button>
        </View>
        <View style={{ height: height * 0.4, marginTop: height * 0.3 }}>
          <View>
            <View>
              <ThemedText>
                This month expenses:{" "}
                {expenses.reduce((pr, exp) => exp.amount, 0)}
              </ThemedText>
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
            if (!category) throw new Error("no such category");

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
                    {category.name}
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
                  <ThemedText>{expense.amount}</ThemedText>
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
        showModal={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
        }}
        expense={expense}
        onSave={addExpense}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
  },
});
