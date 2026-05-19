import type { RecipientRow } from "./batch-store";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type RowValidation = {
  validAddress: boolean;
  validAmount: boolean;
  duplicate: boolean;
  errors: string[];
};

export function validateRows(rows: RecipientRow[]): Record<string, RowValidation> {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = r.address.trim().toLowerCase();
    if (!k) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }

  const out: Record<string, RowValidation> = {};
  for (const r of rows) {
    const addr = r.address.trim();
    const validAddress = ADDRESS_RE.test(addr);
    const amt = Number(r.amount);
    const validAmount =
      r.amount.trim() !== "" && Number.isFinite(amt) && amt > 0;
    const duplicate =
      validAddress && (seen.get(addr.toLowerCase()) ?? 0) > 1;

    const errors: string[] = [];
    if (!validAddress) errors.push("Invalid address");
    if (!validAmount) errors.push("Amount must be a positive number");

    out[r.id] = { validAddress, validAmount, duplicate, errors };
  }
  return out;
}

export function isRowValid(v: RowValidation | undefined) {
  if (!v) return false;
  return v.validAddress && v.validAmount;
}
