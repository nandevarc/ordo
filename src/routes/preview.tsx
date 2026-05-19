import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";

import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { StepIndicator } from "@/components/step-indicator";
import { useBatchStore } from "@/lib/batch-store";
import { validateRows, isRowValid } from "@/lib/validate";
import { USDC_ABI, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";
import { formatUsdcPrecise, truncateAddress } from "@/lib/format";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [{ title: "Preview — Ordo" }],
  }),
  component: PreviewPage,
});

const STEPS = ["Upload", "Preview", "Execute"];
const GAS_PER_RECIPIENT = 65000n;

function PreviewPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { rows } = useBatchStore();

  const validations = useMemo(() => validateRows(rows), [rows]);
  const validRows = rows.filter((r) => isRowValid(validations[r.id]));
  const totalDist = validRows.reduce((a, r) => a + Number(r.amount), 0);

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const balance = balanceRaw
    ? Number(formatUnits(balanceRaw, USDC_DECIMALS))
    : 0;

  const { data: gasPrice } = useQuery({
    queryKey: ["gasPrice"],
    queryFn: async () => {
      if (!publicClient) return 0n;
      return await publicClient.getGasPrice();
    },
    enabled: !!publicClient,
    refetchInterval: 20_000,
  });

  // Estimate: approve (≈55k) + multicall overhead (≈40k) + 65k per recipient
  const totalGasUnits = useMemo(
    () =>
      55_000n + 40_000n + GAS_PER_RECIPIENT * BigInt(validRows.length || 0),
    [validRows.length],
  );

  // Gas is paid in USDC on Arc (units = USDC base units, 6 decimals).
  const gasUsdc =
    gasPrice && gasPrice > 0n
      ? Number(formatUnits(totalGasUnits * gasPrice, USDC_DECIMALS))
      : Number(formatUnits(totalGasUnits * 1_000_000_000n, USDC_DECIMALS));

  const totalRequired = totalDist + gasUsdc;
  const sufficient = balance >= totalRequired;

  if (validRows.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
          <p className="text-muted-foreground">No batch in progress.</p>
          <Link
            to="/create"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
          >
            Start a new batch
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <StepIndicator current={2} labels={STEPS} />
        <h1 className="mt-6 mb-6 text-2xl font-semibold tracking-tight">
          Preview batch
        </h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="card-flat overflow-hidden">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-right font-medium w-32">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {truncateAddress(r.address)}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(r.address);
                              toast.success("Copied");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right mono">
                        {Number(r.amount).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
              {validRows.length} recipients · {totalDist.toFixed(2)} USDC total
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card-flat p-5">
              <h3 className="text-sm font-medium">Cost breakdown</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <Row
                  label="Distribution"
                  value={`${formatUsdcPrecise(totalDist)} USDC`}
                />
                <Row
                  label="Estimated gas"
                  value={`${formatUsdcPrecise(gasUsdc)} USDC`}
                />
                <div className="my-2 h-px bg-border" />
                <Row
                  label="Total required"
                  value={`${formatUsdcPrecise(totalRequired)} USDC`}
                  strong
                />
                <Row
                  label="Your balance"
                  value={
                    isConnected
                      ? `${formatUsdcPrecise(balance)} USDC`
                      : "—"
                  }
                />
              </dl>
              <div
                className={`mt-4 rounded-md px-3 py-2 text-xs ${
                  sufficient
                    ? "border border-success/30 bg-success/5 text-success"
                    : "border border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {sufficient ? "Sufficient balance" : "Insufficient balance"}
              </div>
            </div>

            <div className="card-flat p-5">
              <h3 className="text-sm font-medium">Why Arc</h3>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>
                  Estimated cost on Ethereum mainnet: $12–50 in ETH gas.
                </li>
                <li>
                  Your cost on Arc:{" "}
                  <span className="mono text-foreground">
                    {formatUsdcPrecise(gasUsdc)} USDC
                  </span>
                  .
                </li>
                <li>Gas and payments in one token. No ETH required.</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Link
            to="/create"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-accent"
          >
            Back to upload
          </Link>
          <button
            disabled={!sufficient || !isConnected}
            onClick={() => navigate({ to: "/execute" })}
            className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Execute batch
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mono ${strong ? "text-foreground font-semibold" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}
