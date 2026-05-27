import AsyncStorage from "@react-native-async-storage/async-storage";
import * as z from "zod";

export enum StorageKeyKind {
  categories = "categories",
  expenses = "expenses",
}

type StorageKeyType = keyof typeof StorageKeyKind;

const EMPTY_VALUE = "[]";

const dataSchema = z.array(z.any());

export async function storageSave(key: StorageKeyType, data: string) {
  return AsyncStorage.setItem(key, data);
}

export async function storageReadRaw(key: StorageKeyType) {
  return AsyncStorage.getItem(key);
}

export async function storageRead<T extends unknown[]>(
  key: StorageKeyType,
): Promise<T> {
  let data = await storageReadRaw(key);
  if (!data) {
    storageSave(key, EMPTY_VALUE);
    data = EMPTY_VALUE;
  }

  const res = dataSchema.parse(JSON.parse(data));

  return res as T;
}
