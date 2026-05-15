import ExpenseModal from "@/components/expense-modal";
import ThemedText from "@/components/ui/themed-text";
import { SIZE } from "@/constants/tokens";
import { Category, Expense } from "@/types/entities";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import "react-native-get-random-values";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from 'uuid';

export default function Index() {
  const [showModal, setShowModal] = useState(false);

  const [categoreis, setCategories] = useState<Category[]>([
    { id: '1', name: 'food' },
    { id: '2', name: 'clodth' },
    { id: '3', name: 'donner' },
  ]);

  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [expense, setExpense] = useState<Expense>({
    id: uuid(),
    amount: 0.00,
    date: (() => {
      const date = new Date;
      return date.toLocaleString()
    })(),
    categoryId: '0'
  })

  const showExpenseModal = (categoryId: string) => {
    setExpense({
      id: uuid(),
      amount: 0.00,
      date: (() => {
        const date = new Date;
        return date.toLocaleString()
      })(),
      categoryId
    });
    setShowModal(true)
  }

  const showCategoryModal = () => { }

  const addExpense = (expense: Expense) => {
    setExpenses(prev => ([...prev, expense]))
    setShowModal(false)
  }

  return (
    <SafeAreaView
      style={styles.main}
    >
      <View>
        <View>
          <ThemedText>This month expenses:</ThemedText>
        </View>
      </View>

      <ThemedText>Categories:</ThemedText>
      <View style={{ flexDirection: "row", flexWrap: 'wrap', gap: 16 }}>
        {categoreis.map(el =>
          <Pressable key={el.id} onPress={() => showExpenseModal(el.id)} style={{ width: SIZE["64"], height: SIZE["64"], borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.7)" }}>
            <ThemedText>{el.name}</ThemedText>
          </Pressable>
        )}
        <Pressable onPress={showCategoryModal} style={{ width: SIZE["64"], height: SIZE["64"], borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.7)" }}>
          <ThemedText>add category</ThemedText>
        </Pressable>
      </View>
      <ExpenseModal
        showModal={showModal}
        onClose={() => { setShowModal(false) }}
        expense={expense}
        onSave={addExpense} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111"
  }
})

