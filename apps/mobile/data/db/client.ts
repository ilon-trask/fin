import AsyncStorage from "@react-native-async-storage/async-storage";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { migrateDatabase } from "./migrations";
import { createRepository, type Repository } from "./repository";
import { parseCollection, type Kind } from "../sync/protocol";

let initialization: Promise<Repository> | undefined;
export function getRepository(): Promise<Repository> {
  initialization ??= (async () => {
    const sqlite = await openDatabaseAsync("fin.db");
    migrateDatabase(sqlite);
    const repository = createRepository(drizzle(sqlite), uuid);
    if (!repository.meta("legacy-migrated")) {
      const kinds: Kind[] = ["categories", "expenses"];
      const collections = await Promise.all(kinds.map(async (kind) => {
        const raw = await AsyncStorage.getItem(kind);
        return { kind, entities: raw ? parseCollection(kind, raw) : [] };
      }));
      repository.migrateLegacy(collections);
      // Original AsyncStorage values remain as a recovery backup.
    }
    return repository;
  })().catch((error) => { initialization = undefined; throw error; });
  return initialization;
}
