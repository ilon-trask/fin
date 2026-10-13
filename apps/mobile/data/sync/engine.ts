import { responseSchema } from "./protocol";
import type { Repository } from "../db/repository";

export async function exchange(repository: Repository, endpoint: string, token: string, signal?: AbortSignal) {
  const operations = repository.pending();
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/sync`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cursor: repository.cursor(), operations }), signal,
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Sync token was rejected" : `Sync server returned ${response.status}`);
  const result = responseSchema.parse(await response.json());
  if (result.acknowledged.length !== operations.length || operations.some((op) => !result.acknowledged.includes(op.operationId))) throw new Error("Server did not acknowledge the full batch");
  repository.apply(result, operations.map((op) => op.operationId));
  return result.hasMore || repository.pendingCount() > 0;
}
