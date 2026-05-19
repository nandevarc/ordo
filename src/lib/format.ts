export function truncateAddress(addr: string, head = 6, tail = 4) {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatUsdc(n: number | string, digits = 2) {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatUsdcPrecise(n: number) {
  if (!Number.isFinite(n)) return "0.000000";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}
