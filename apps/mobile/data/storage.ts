import { getRepository } from "./db/client";
import { parseCollection, type Entity, type Kind } from "./sync/protocol";

export enum StorageKeyKind { categories = "categories", expenses = "expenses" }
export async function storageSaveRaw(key: Kind, data: string) {
  (await getRepository()).replace(key, parseCollection(key, data));
}
export async function storageReadRaw(key: Kind) { return JSON.stringify(await storageRead(key)); }
export async function storageSave(key: Kind, data: string) { return storageSaveRaw(key, data); }
export async function storageRead<T extends unknown[]>(key: Kind): Promise<T> { return (await getRepository()).list(key) as T; }
export async function storageUpsert(key: Kind, entity: Entity) { (await getRepository()).upsert(key, entity); }
export async function storageRemove(key: Kind, id: string) { (await getRepository()).remove(key, id); }
export function subscribeStorage(listener: () => void) {
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;
  void getRepository().then((repository) => { if (!cancelled) unsubscribe = repository.subscribe(listener); }).catch(() => {});
  return () => { cancelled = true; unsubscribe?.(); };
}
