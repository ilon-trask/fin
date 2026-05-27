import { tryCatch } from "@/utils/tryCatch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as z from "zod";

const VERSION = "0.0";

type StorageData<T> = {
  version: string;
  data: T;
};

export enum StorageKeyKind {
  categories = "categories",
  expenses = "expenses",
}

type StorageKeyType = keyof typeof StorageKeyKind;

const EMPTY_VALUE = `{ "version": ${VERSION}, "data":[] }`;

const dataSchema = z.array(z.any());
const storageSchema = z.object({ version: z.string(), data: dataSchema });

export async function storageSaveRaw(key: StorageKeyType, data: string) {
  return AsyncStorage.setItem(key, data);
}

export async function storageReadRaw(key: StorageKeyType) {
  return AsyncStorage.getItem(key);
}

export async function storageSave(key: StorageKeyType, data: string) {
  const storage: StorageData<any> = { version: VERSION, data };
  return AsyncStorage.setItem(key, JSON.stringify(storage));
}

export async function storageRead<T extends unknown[]>(
  key: StorageKeyType,
): Promise<T> {
  let storage = await storageReadRaw(key);
  let [err, value] = tryCatch(() => storageSchema.parse(JSON.parse(storage!)));
  if (err || value?.version !== VERSION) {
    storageSaveRaw(key, EMPTY_VALUE);
    value = JSON.parse(EMPTY_VALUE);
  }
  const data = value!.data;

  return data as T;
}
