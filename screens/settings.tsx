import Button from "@/components/ui/button";
import ThemedText from "@/components/ui/themed-text";
import { COLOR } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSaveRaw } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

export default function Settings() {
  async function exportData() {
    const categories = await storageRead<Category[]>(StorageKeyKind.categories);
    const expenses = await storageRead<Expense[]>(StorageKeyKind.expenses);

    return expenses.map((exp) => {
      const category = categories.find((el) => el.id === exp.categoryId);

      const { categoryId, ...rest } = exp;
      return { ...rest, category: category?.name || "notFound" };
    });
  }

  type ExpenseData = Omit<Expense, "categoryId"> & { category: string };

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
    storageSaveRaw(StorageKeyKind.categories, JSON.stringify(categories));
    storageSaveRaw(StorageKeyKind.expenses, JSON.stringify(expenses));
    return expenses;
  }

  const { height } = Dimensions.get("window");

  return (
    <SafeAreaView
      style={{
        backgroundColor: COLOR.bg,
        height,
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
    </SafeAreaView>
  );
}
