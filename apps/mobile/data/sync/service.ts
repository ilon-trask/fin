import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { getRepository } from "../db/client";
import { exchange } from "./engine";

export type SyncStatus = {
  state: "local" | "offline" | "idle" | "syncing" | "error";
  pending: number;
  endpoint: string;
  lastSync?: string;
  error?: string;
};

const ENDPOINT_KEY = "fin-sync-endpoint";
const TOKEN_KEY = "fin-sync-token";
const REQUEST_TIMEOUT_MS = 15_000;
const IDLE_POLL_MS = 15_000;
const MAX_RETRY_MS = 60_000;
const MAX_BATCHES_PER_PASS = 20;
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

let status: SyncStatus = { state: "local", pending: 0, endpoint: "" };
let token = "";
let running: Promise<void> | undefined;
let stopped = true;
let generation = 0;
let retry: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
let controller: AbortController | undefined;
const listeners = new Set<() => void>();

function publish(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
}

export const syncStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => status,
};

function normalizeEndpoint(endpoint: string, nextToken: string): string {
  const clean = endpoint.trim().replace(/\/$/, "");
  if (!clean) return clean;

  const url = new URL(clean);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Use a server URL without credentials, query parameters or fragments");
  }
  const localHttp = url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Use HTTPS, or HTTP on localhost / Android emulator");
  }
  if (!nextToken.trim()) throw new Error("Enter a sync token");
  return clean;
}

async function saveToken(value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, value);
  } else if (value) {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function loadToken(): Promise<string> {
  const saved = Platform.OS === "web"
    ? await AsyncStorage.getItem(TOKEN_KEY)
    : await SecureStore.getItemAsync(TOKEN_KEY);
  return saved ?? "";
}

export async function configureSync(endpoint: string, nextToken: string) {
  const clean = normalizeEndpoint(endpoint, nextToken);
  const trimmedToken = nextToken.trim();
  controller?.abort();
  await running;

  const repository = await getRepository();
  // A cursor from one server could skip every record on another server.
  if (clean && status.endpoint && clean !== status.endpoint) {
    throw new Error("Disconnect before changing the sync server");
  }
  if (clean !== status.endpoint) {
    repository.setMeta("cursor", "0");
    // Requeue local records and tombstones for a new connection.
    repository.requeueAll();
  }

  await saveToken(trimmedToken);
  await AsyncStorage.setItem(ENDPOINT_KEY, clean);
  token = trimmedToken;
  failures = 0;
  publish({ endpoint: clean, state: clean ? "idle" : "local", error: undefined });
  void syncNow();
}

function schedule(delay: number) {
  if (stopped) return;
  clearTimeout(retry);
  retry = setTimeout(() => { void syncNow(); }, delay);
}

function nextPollDelay(): number {
  return failures
    ? Math.min(MAX_RETRY_MS, 1_000 * 2 ** Math.min(failures, 6))
    : IDLE_POLL_MS;
}

async function syncPass() {
  const repository = await getRepository();
  publish({ pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
  if (!status.endpoint || !token) {
    publish({ state: "local" });
    return;
  }

  const network = await Network.getNetworkStateAsync();
  if (network.isConnected === false || network.isInternetReachable === false) {
    publish({ state: "offline" });
    return;
  }

  publish({ state: "syncing", error: undefined });
  let more = true;
  // A pass is bounded so ongoing edits cannot keep a foreground sync running forever.
  for (let batch = 0; more && batch < MAX_BATCHES_PER_PASS && !stopped; batch++) {
    const requestController = new AbortController();
    controller = requestController;
    const timeout = setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);
    try {
      more = await exchange(repository, status.endpoint, token, requestController.signal);
    } finally {
      clearTimeout(timeout);
      controller = undefined;
    }
  }
  failures = 0;
  publish({ state: "idle", pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
}

export function syncNow(): Promise<void> {
  if (running) return running;
  if (stopped) return Promise.resolve();

  running = syncPass().catch((error: unknown) => {
    if (stopped) return;
    failures++;
    publish({ state: "error", error: error instanceof Error ? error.message : "Sync failed" });
  }).finally(() => {
    running = undefined;
    schedule(nextPollDelay());
  });
  return running;
}

export function startSync() {
  stopped = false;
  const currentGeneration = ++generation;
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    const repository = await getRepository();
    if (stopped || currentGeneration !== generation) return;
    const endpoint = await AsyncStorage.getItem(ENDPOINT_KEY) ?? "";
    const savedToken = await loadToken();
    if (stopped || currentGeneration !== generation) return;

    token = savedToken;
    publish({ endpoint, pending: repository.pendingCount(), lastSync: repository.meta("last-sync") });
    unsubscribe = repository.subscribe(() => {
      publish({ pending: repository.pendingCount() });
      schedule(250);
    });
    void syncNow();
  })().catch((error: unknown) => {
    if (!stopped && currentGeneration === generation) {
      publish({ state: "error", error: error instanceof Error ? error.message : "Sync failed" });
    }
  });

  const network = Network.addNetworkStateListener((state) => {
    if (state.isConnected) schedule(0);
    else publish({ state: "offline" });
  });
  const app = AppState.addEventListener("change", (state) => {
    if (state === "active") schedule(0);
  });

  return () => {
    if (currentGeneration === generation) {
      stopped = true;
      generation++;
      controller?.abort();
      clearTimeout(retry);
    }
    unsubscribe?.();
    network.remove();
    app.remove();
  };
}
