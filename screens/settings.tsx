import Button from "@/components/ui/button";
import ThemedInput from "@/components/ui/themed-Input";
import ThemedText from "@/components/ui/themed-text";
import { COLOR } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSave } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

type SettingsProps = {
  disableParentScroll?: () => void;
  enableParentScroll?: () => void;
};

type ExpenseData = Omit<Expense, "categoryId"> & { category: string };

export default function Settings({
  disableParentScroll,
  enableParentScroll,
}: SettingsProps) {
  const [importText, setImportText] = useState("");

  async function exportData() {
    const categories = await storageRead<Category[]>(StorageKeyKind.categories);
    const expenses = await storageRead<Expense[]>(StorageKeyKind.expenses);

    return expenses.map((exp) => {
      const category = categories.find((el) => el.id === exp.categoryId);
      const { categoryId, ...rest } = exp;
      return { ...rest, category: category?.name || "notFound" };
    });
  }

  async function handleExport() {
    const data = await exportData();
    await Share.share({
      message: JSON.stringify(data, null, 2),
    });
  }

  async function importData(rawData: string) {
    const data: ExpenseData[] = JSON.parse(rawData);
    const categories: Category[] = [];
    const expenses: Expense[] = [];

    data.forEach((exp) => {
      let categoryId = categories.find(
        (category) => category.name === exp.category,
      )?.id;

      if (!categoryId) {
        categoryId = uuid();
        categories.push({
          id: categoryId,
          color: "#6fff00",
          name: exp.category,
        });
      }

      const { category, ...rest } = exp;
      expenses.push({ ...rest, categoryId });
    });

    await storageSave(StorageKeyKind.categories, categories);
    await storageSave(StorageKeyKind.expenses, expenses);
    return expenses;
  }

  async function handleImport() {
    if (!importText.trim()) {
      Alert.alert("Import failed", "Paste exported JSON data first.");
      return;
    }

    try {
      await importData(importText);
      setImportText("");
      Alert.alert("Import complete", "Your expenses were imported.");
    } catch {
      Alert.alert("Import failed", "The pasted data is not valid JSON.");
    }
  }

  const { height } = Dimensions.get("window");

  return (
    <SafeAreaView style={[styles.container, { height }]}>
      <View
        onTouchStart={disableParentScroll}
        onTouchEnd={enableParentScroll}
      />
      <View style={styles.actions}>
        <Button onPress={handleImport}>
          <ThemedText>Import</ThemedText>
        </Button>
        <Button onPress={handleExport}>
          <ThemedText>Export</ThemedText>
        </Button>
      </View>
      <ThemedText style={styles.label}>Paste export data to import</ThemedText>
      <ThemedInput
        multiline
        placeholder='[{"id":"...","amount":10,"date":"...","category":"food"}]'
        value={importText}
        onChangeText={setImportText}
        style={styles.importInput}
        onFocus={disableParentScroll}
        onBlur={enableParentScroll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLOR.bg,
    padding: 10,
    gap: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  label: {
    fontSize: 14,
  },
  importInput: {
    minHeight: 160,
    textAlignVertical: "top",
    padding: 12,
  },
});
