import Button from "@/components/ui/button";
import ThemedText from "@/components/ui/themed-text";
import { COLOR } from "@/constants/tokens";
import { StorageKeyKind, storageRead, storageSaveRaw } from "@/data/storage";
import { Category, Expense } from "@/types/entities";
import { googlePay } from "@/integrations/google-pay";
import { useEffect, useState } from "react";
import { Alert, AppState, Dimensions, Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { v4 as uuid } from "uuid";

export default function Settings(props: any) {
  const [payStatus, setPayStatus] = useState(googlePay.status);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => setPayStatus(googlePay.status()));
    return () => subscription.remove();
  }, []);
  async function enableGooglePay() {
    try {
      await googlePay.requestNotifications();
      googlePay.setEnabled(true);
      setPayStatus(googlePay.status());
      if (!googlePay.status().accessGranted) googlePay.openAccessSettings();
    } catch {
      Alert.alert("Could not enable Google Pay reminders", "Please try again in Android settings.");
    }
  }
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
      <View
        onTouchStart={props.disableParentScroll}
        onTouchEnd={props.enableParentScroll}
      ></View>
      <View style={{ padding: 16, gap: 12 }}>
        <ThemedText style={{ fontSize: 22 }}>Google Pay</ThemedText>
        <ThemedText>Get an Add payment reminder after a Google Pay or Wallet payment notification. Review the amount and choose a category before saving.</ThemedText>
        <ThemedText>Android notification access allows Fin to read notifications. Fin only stores matching payment alerts from Google Pay/Wallet locally on this device.</ThemedText>
        {!googlePay.available ? (
          <ThemedText>Requires an Android native build. Unavailable in Expo Go, iOS and web.</ThemedText>
        ) : (
          <>
            <ThemedText>{payStatus.enabled ? "Reminders enabled" : "Reminders disabled"}</ThemedText>
            <Button onPress={payStatus.enabled ? () => {
              googlePay.setEnabled(false);
              setPayStatus(googlePay.status());
            } : enableGooglePay}>
              <ThemedText>{payStatus.enabled ? "Disable reminders" : "Enable reminders"}</ThemedText>
            </Button>
            {payStatus.enabled && !payStatus.accessGranted && (
              <Button onPress={googlePay.openAccessSettings}><ThemedText>Allow notification access</ThemedText></Button>
            )}
            {payStatus.enabled && !payStatus.notificationsGranted && (
              <Button onPress={() => Linking.openSettings()}><ThemedText>Allow Fin notifications</ThemedText></Button>
            )}
          </>
        )}
      </View>
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
