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

const EMPTY_VALUE = JSON.stringify({ version: VERSION, data: [] });

const dataSchema = z.array(z.any());
const storageSchema = z.object({ version: z.string(), data: dataSchema });

export async function storageSaveRaw(key: StorageKeyType, data: string) {
  return AsyncStorage.setItem(key, data);
}

export async function storageReadRaw(key: StorageKeyType) {
  return AsyncStorage.getItem(key);
}

export async function storageSave<T extends unknown[]>(
  key: StorageKeyType,
  data: T,
) {
  const storage: StorageData<T> = { version: VERSION, data };
  return AsyncStorage.setItem(key, JSON.stringify(storage));
}

export async function storageRead<T extends unknown[]>(
  key: StorageKeyType,
): Promise<T> {
  const storage = await storageReadRaw(key);

  if (!storage) {
    await storageSaveRaw(key, EMPTY_VALUE);
    return [] as unknown as T;
  }

  const [parseErr, parsed] = tryCatch(() => JSON.parse(storage));
  if (parseErr) {
    await storageSaveRaw(key, EMPTY_VALUE);
    return [] as unknown as T;
  }

  if (Array.isArray(parsed)) {
    await storageSave(key, parsed as T);
    return parsed as T;
  }

  const [err, value] = tryCatch(() => storageSchema.parse(parsed));
  if (err || value?.version !== VERSION) {
    await storageSaveRaw(key, EMPTY_VALUE);
    return [] as unknown as T;
  }

  return value!.data as T;
}
