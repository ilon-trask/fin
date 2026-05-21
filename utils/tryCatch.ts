type TryCatchResult<T> = [Error, null] | [null, T];

export function tryCatch<T>(callback: () => T): TryCatchResult<T>;

export function tryCatch<T>(
  callback: () => Promise<T>,
): Promise<TryCatchResult<T>>;

export function tryCatch<T>(
  callback: () => T | Promise<T>,
): TryCatchResult<T> | Promise<TryCatchResult<T>> {
  try {
    const result = callback();

    if (result instanceof Promise) {
      return result
        .then((data) => [null, data] as TryCatchResult<T>)
        .catch((e) => [
          e instanceof Error ? e : new Error("Unknown error"),
          null,
        ]);
    }

    return [null, result];
  } catch (e) {
    return [e instanceof Error ? e : new Error("Unknown error"), null];
  }
}
