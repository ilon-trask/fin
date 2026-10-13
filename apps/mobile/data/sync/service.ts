import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { getRepository } from "../db/client";
import { exchange } from "./engine";

export type SyncStatus = { state: "local" | "offline" | "idle" | "syncing" | "error"; pending: number; lastSync?: string; error?: string; endpoint: string };
let status: SyncStatus = { state: "local", pending: 0, endpoint: "" };
const listeners = new Set<() => void>();
let token = "";
let running: Promise<void> | undefined;
let stopped = true;
let generation = 0;
let retry: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
let controller: AbortController | undefined;
const publish = (patch: Partial<SyncStatus>) => { status = { ...status, ...patch }; listeners.forEach((listener) => listener()); };
const tokenKey = "fin-sync-token";
export const syncStore = { subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, getSnapshot: () => status };

export async function configureSync(endpoint: string, nextToken: string) {
  const clean = endpoint.trim().replace(/\/$/, "");
  if (clean) {
    const url = new URL(clean);
    if (url.username || url.password || url.search || url.hash) throw new Error("Use a server URL without credentials, query parameters or fragments");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname))) throw new Error("Use HTTPS, or HTTP on localhost / Android emulator");
    if (!nextToken.trim()) throw new Error("Enter a sync token");
  }
  controller?.abort();
  await running;
  const repository = await getRepository();
  // Changing datasets with a nonzero cursor could skip all records on the new server.
  if (clean && status.endpoint && clean !== status.endpoint) throw new Error("Disconnect before changing the sync server");
  if (clean !== status.endpoint) {
    repository.setMeta("cursor", "0");
    // Requeue the full local state, including tombstones, on a new connection.
    // Initial unsynced operations already cover all records on a fresh install.
    repository.requeueAll();
  }
  if (Platform.OS === "web") await AsyncStorage.setItem(tokenKey, nextToken.trim());
  else if (nextToken.trim()) await SecureStore.setItemAsync(tokenKey, nextToken.trim());
  else await SecureStore.deleteItemAsync(tokenKey);
  await AsyncStorage.setItem("fin-sync-endpoint", clean);
  token = nextToken.trim();
  failures = 0;
  publish({ endpoint: clean, state: clean ? "idle" : "local", error: undefined });
  void syncNow();
}

export function syncNow(): Promise<void> {
  if (running) return running;
  if (stopped) return Promise.resolve();
  running = (async () => {
    const repository = await getRepository();
    publish({ pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
    if (!status.endpoint || !token) { publish({ state: "local" }); return; }
    const network = await Network.getNetworkStateAsync();
    if (network.isConnected === false || network.isInternetReachable === false) { publish({ state: "offline" }); return; }
    publish({ state: "syncing", error: undefined });
    let more = true;
    // Bound each foreground pass so ongoing edits cannot monopolize the engine.
    for (let batch = 0; more && batch < 20 && !stopped; batch++) {
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try { more = await exchange(repository, status.endpoint, token, controller.signal); }
      finally { clearTimeout(timeout); controller = undefined; }
    }
    failures = 0;
    publish({ state: "idle", pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
  })().catch((error: unknown) => {
    failures++;
    publish({ state: "error", error: error instanceof Error ? error.message : "Sync failed" });
  }).finally(() => {
    running = undefined;
    if (!stopped) schedule(Math.min(60000, failures ? 1000 * 2 ** Math.min(failures, 6) : 15000));
  });
  return running;
}
function schedule(delay: number) {
  if (stopped) return;
  clearTimeout(retry);
  retry = setTimeout(() => { void syncNow(); }, delay);
}
export function startSync() {
  stopped = false;
  const currentGeneration = ++generation;
  let unsubscribe: (() => void) | undefined;
  void (async () => {
    const repository = await getRepository();
    if (stopped || currentGeneration !== generation) return;
    const endpoint = await AsyncStorage.getItem("fin-sync-endpoint") ?? "";
    token = (Platform.OS === "web" ? await AsyncStorage.getItem(tokenKey) : await SecureStore.getItemAsync(tokenKey)) ?? "";
    if (stopped || currentGeneration !== generation) return;
    publish({ endpoint, pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
    unsubscribe = repository.subscribe(() => { publish({ pending: repository.pendingCount() }); schedule(250); });
    void syncNow();
  })().catch((error) => publish({ state: "error", error: String(error) }));
  const network = Network.addNetworkStateListener((state) => { if (state.isConnected) schedule(0); else publish({ state: "offline" }); });
  const app = AppState.addEventListener("change", (state) => { if (state === "active") schedule(0); });
  return () => {
    if (currentGeneration === generation) {
      stopped = true;
      generation++;
      controller?.abort();
      clearTimeout(retry);
    }
    unsubscribe?.(); network.remove(); app.remove();
  };
}
