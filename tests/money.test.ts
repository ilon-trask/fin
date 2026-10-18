import { test } from "node:test";
import assert from "node:assert/strict";
import { amountFractionDigits, formatAmount } from "../apps/mobile/utils/money";

test("captured currency amounts retain their precision in drafts, totals and analytics", () => {
  assert.equal(formatAmount(12.345, "KWD"), "12.345");
  assert.equal(formatAmount(12.345, "BHD"), "12.345");
  assert.equal(amountFractionDigits("KWD"), 3);
  assert.equal(formatAmount(12.5, "CHF"), "12.50");
  assert.equal(formatAmount(12.5, "EUR"), "12.50");
  assert.equal(formatAmount(12.5), "12.50");
  assert.equal(formatAmount(12.5, "legacy"), "12.50");
});
