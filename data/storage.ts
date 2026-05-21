import { tryCatch } from "@/utils/tryCatch";
import AsyncStorage from "@react-native-async-storage/async-storage";

export enum StoreKeyKind {
  categories = "categories",
  expenses = "expenses",
}

type StoreKeyType = keyof typeof StoreKeyKind;

const EMPTY_VALUE = "[]";

export async function storageSave(key: StoreKeyType, data: string) {
  const [err] = await tryCatch(() => AsyncStorage.setItem(key, data));
  if (err) throw err;
}

export async function storageReadRaw(key: StoreKeyType) {
  const res = tryCatch<string | null>(() => AsyncStorage.getItem(key));
  return res;
}

export async function storageRead<T>(key: StoreKeyType) {
  let [err, rawData] = await storageReadRaw(key);
  if (err) return [err, null] as const;
  if (!rawData) {
    storageSave(key, EMPTY_VALUE);
    rawData = EMPTY_VALUE;
  }
  const res = tryCatch<T>(() => JSON.parse(rawData));
  return res;
}
