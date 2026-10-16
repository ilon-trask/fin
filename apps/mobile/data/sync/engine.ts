import { responseSchema } from "./protocol";
import type { Repository } from "../db/repository";

export async function exchange(
  repository: Repository,
  endpoint: string,
  token: string,
  signal?: AbortSignal,
) {
  const operations = repository.pending();
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cursor: repository.cursor(), operations }),
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 401
      ? "Sync token was rejected"
      : `Sync server returned ${response.status}`);
  }

  const result = responseSchema.parse(await response.json());
  const acknowledged = new Set(result.acknowledged);
  const complete = result.acknowledged.length === operations.length
    && acknowledged.size === operations.length
    && operations.every((operation) => acknowledged.has(operation.operationId));
  if (!complete) throw new Error("Server did not acknowledge the full batch");

  repository.apply(result, operations.map((operation) => operation.operationId));
  return result.hasMore || repository.pendingCount() > 0;
}
