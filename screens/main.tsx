import CategoryModal from "@/components/category-modal";
import ExpenseModal from "@/components/expense-modal";
import ThemedText from "@/components/ui/themed-text";
import { COLOR, SIZE } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSaveRaw } from "@/data/storage";
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

export default function Main() {
  const { height } = Dimensions.get("window");
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
      storageSaveRaw(StorageKeyKind.expenses, JSON.stringify(data));
      return data;
    });
    setShowExpenseModal(false);
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
    })();
  }, []);

  return (
    <SafeAreaView style={styles.main}>
      <ScrollView style={{ width: "100%" }}>
        <View style={{ height: height * 0.4 }}>
          <View style={{ alignSelf: "flex-end" }}>
            <View>
              <ThemedText style={{ fontSize: 24 }}>
                {new Date().toLocaleString("default", { month: "long" })}
              </ThemedText>
              <ThemedText style={{ fontSize: 64 }}>
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
    padding: 10,
    flex: 1,
    backgroundColor: COLOR.bg,
  },
});
