const fractionDigits = new Map<string, number>();

export function amountFractionDigits(currency?: string): number {
  if (!currency) return 2;
  const cached = fractionDigits.get(currency);
  if (cached !== undefined) return cached;
  try {
    const digits = Math.max(2, new Intl.NumberFormat("en", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2);
    fractionDigits.set(currency, digits);
    return digits;
  } catch {
    return 2;
  }
}

export function formatAmount(amount: number, currency?: string): string {
  return amount.toFixed(amountFractionDigits(currency));
}
