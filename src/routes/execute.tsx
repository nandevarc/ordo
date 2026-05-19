import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  encodeFunctionData,
  parseUnits,
  formatUnits,
  decodeEventLog,
  type Address,
  type Hex,
} from "viem";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { StepIndicator } from "@/components/step-indicator";
import { useBatchStore, type ExecutionResult } from "@/lib/batch-store";
import { validateRows, isRowValid } from "@/lib/validate";
import {
  USDC_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  arcTestnet,
} from "@/lib/chain";
import { formatUsdc, formatUsdcPrecise, truncateAddress } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/execute")({
  head: () => ({ meta: [{ title: "Execute — Ordo" }] }),
  component: ExecutePage,
});

const STEPS = ["Upload", "Preview", "Execute"];

type Phase = "idle" | "approving" | "executing" | "done" | "error";

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const;

function ExecutePage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const {
    rows,
    batchName,
    txHash,
    setTxHash,
    results,
    setResults,
    reset,
  } = useBatchStore();

  const validations = useMemo(() => validateRows(rows), [rows]);
  const validRows = useMemo(
    () => rows.filter((r) => isRowValid(validations[r.id])),
    [rows, validations],
  );
  const totalAmount = validRows.reduce((a, r) => a + Number(r.amount), 0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("Preparing batch transaction…");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!isConnected || !walletClient || !publicClient || !address) return;
    if (validRows.length === 0) return;
    startedRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, walletClient, publicClient, address]);

  async function run() {
    try {
      if (!walletClient || !publicClient || !address) return;

      // 1. Approve Multicall3
      setPhase("approving");
      setPhaseMessage("Waiting for wallet confirmation (approve)…");

      const totalUnits = parseUnits(totalAmount.toFixed(6), USDC_DECIMALS);

      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [MULTICALL3_ADDRESS, totalUnits],
        chain: arcTestnet,
        account: address,
      });
      setPhaseMessage("Approval submitted. Waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2. Build aggregate3 calls — transferFrom(user → recipient, amount)
      setPhase("executing");
      setPhaseMessage("Waiting for wallet confirmation (batch)…");

      const calls = validRows.map((r) => ({
        target: USDC_ADDRESS as Address,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: USDC_ABI,
          functionName: "transferFrom",
          args: [
            address,
            r.address as Address,
            parseUnits(Number(r.amount).toFixed(6), USDC_DECIMALS),
          ],
        }) as Hex,
      }));

      const initialResults: ExecutionResult[] = validRows.map((_, i) => ({
        index: i,
        status: "pending",
      }));
      setResults(initialResults);

      const batchHash = await walletClient.writeContract({
        address: MULTICALL3_ADDRESS,
        abi: MULTICALL3_ABI,
        functionName: "aggregate3",
        args: [calls],
        chain: arcTestnet,
        account: address,
      });
      setTxHash(batchHash);
      setPhaseMessage("Batch submitted. Confirming on-chain…");
      setProgress(15);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: batchHash,
      });
      setProgress(85);

      // 3. Determine per-recipient outcome via Transfer events
      const transfers = receipt.logs
        .filter(
          (l) =>
            l.address.toLowerCase() === USDC_ADDRESS.toLowerCase(),
        )
        .map((l) => {
          try {
            const ev = decodeEventLog({
              abi: [TRANSFER_EVENT],
              data: l.data,
              topics: l.topics,
            });
            return ev.args as { from: Address; to: Address; value: bigint };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as { from: Address; to: Address; value: bigint }[];

      const finalResults: ExecutionResult[] = validRows.map((r, i) => {
        const expectedTo = r.address.toLowerCase();
        const expectedAmount = parseUnits(
          Number(r.amount).toFixed(6),
          USDC_DECIMALS,
        );
        const hit = transfers.find(
          (t) =>
            t.from.toLowerCase() === address.toLowerCase() &&
            t.to.toLowerCase() === expectedTo &&
            t.value === expectedAmount,
        );
        return {
          index: i,
          status: hit ? "success" : "failed",
          error: hit ? undefined : "Transfer reverted",
        };
      });
      setResults(finalResults);
      setProgress(100);

      // 4. Persist
      const success = finalResults.filter((r) => r.status === "success").length;
      const failed = finalResults.length - success;
      const status =
        failed === 0 ? "completed" : success === 0 ? "failed" : "partial";

      const gasUsedUsdc = Number(
        formatUnits(
          receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n),
          USDC_DECIMALS,
        ),
      );

      try {
        const { data: batch, error } = await supabase
          .from("batches")
          .insert({
            wallet_address: address.toLowerCase(),
            batch_name: batchName || null,
            total_amount: totalAmount,
            recipient_count: validRows.length,
            successful_count: success,
            failed_count: failed,
            status,
            tx_hash: batchHash,
            gas_used_usdc: gasUsedUsdc,
          })
          .select()
          .single();
        if (error) throw error;
        if (batch) {
          await supabase.from("recipients").insert(
            validRows.map((r, i) => ({
              batch_id: batch.id,
              wallet_address: r.address.toLowerCase(),
              amount: Number(r.amount),
              note: r.note || null,
              status: finalResults[i].status,
              error_message: finalResults[i].error ?? null,
            })),
          );
        }
      } catch (dbErr) {
        console.error("Failed to save batch history", dbErr);
      }

      setPhase("done");
    } catch (e) {
      const msg = (e as Error)?.message ?? "Transaction failed";
      console.error(e);
      setErrorMsg(msg);
      setPhase("error");
      toast.error(msg.slice(0, 140));
    }
  }

  function exportCsv() {
    const lines = ["address,amount,note,status,error"];
    validRows.forEach((r, i) => {
      const res = results[i];
      lines.push(
        [
          r.address,
          r.amount,
          (r.note ?? "").replace(/,/g, " "),
          res?.status ?? "pending",
          (res?.error ?? "").replace(/,/g, " "),
        ].join(","),
      );
    });
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordo-batch-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const isProcessing = phase === "approving" || phase === "executing";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {phase !== "executing" && <Nav />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <StepIndicator current={3} labels={STEPS} />

        <div className="mt-8">
          {/* State: preparing / processing */}
          {(phase === "idle" || phase === "approving" || phase === "executing") && (
            <div className="card-flat p-8">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <h2 className="text-base font-medium text-foreground">
                    {phase === "executing"
                      ? "Processing batch…"
                      : "Preparing batch transaction…"}
                  </h2>
                  <p className="text-xs text-muted-foreground">{phaseMessage}</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {progress}% — do not close this tab.
                </p>
              </div>

              <RecipientList
                rows={validRows}
                results={results}
              />
            </div>
          )}

          {/* State: done */}
          {phase === "done" && (
            <div className="card-flat p-8">
              <div className="flex items-center gap-3">
                {failedCount === 0 ? (
                  <CheckCircle2 className="h-7 w-7 text-success" />
                ) : (
                  <AlertTriangle className="h-7 w-7 text-warning" />
                )}
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {successCount} of {validRows.length} payments successful
                  </h2>
                  <p className="text-xs text-muted-foreground mono">
                    Total {formatUsdc(totalAmount)} USDC ·{" "}
                    {failedCount > 0 ? "Partial settlement" : "Completed"}
                  </p>
                </div>
              </div>

              {txHash && (
                <div className="mt-5 rounded-md border border-border bg-surface-muted p-3 text-xs">
                  <div className="text-muted-foreground">Transaction</div>
                  <a
                    href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono mt-1 inline-flex items-center gap-1 text-foreground hover:underline"
                  >
                    {truncateAddress(txHash, 10, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <RecipientList rows={validRows} results={results} />

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-accent"
                >
                  Export results CSV
                </button>
                <button
                  onClick={() => {
                    reset();
                    navigate({ to: "/create" });
                  }}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  New batch
                </button>
                <Link
                  to="/history"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  View history →
                </Link>
              </div>
            </div>
          )}

          {/* State: error */}
          {phase === "error" && (
            <div className="card-flat border-destructive/30 bg-destructive/5 p-8">
              <div className="flex items-center gap-3">
                <XCircle className="h-7 w-7 text-destructive" />
                <div>
                  <h2 className="text-base font-medium text-foreground">
                    Batch failed
                  </h2>
                  <p className="mt-1 text-xs text-destructive">{errorMsg}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <Link
                  to="/preview"
                  className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-accent"
                >
                  Back to preview
                </Link>
                <button
                  onClick={() => {
                    startedRef.current = false;
                    setErrorMsg(null);
                    setPhase("idle");
                    setProgress(0);
                    void run();
                  }}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      {!isProcessing && <Footer />}
    </div>
  );
}

function RecipientList({
  rows,
  results,
}: {
  rows: { id: string; address: string; amount: string; note: string }[];
  results: ExecutionResult[];
}) {
  return (
    <div className="mt-6 card-flat overflow-hidden">
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Recipient</th>
              <th className="px-3 py-2 text-right font-medium w-28">Amount</th>
              <th className="px-3 py-2 text-left font-medium w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const res = results[i];
              return (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 mono text-xs">
                    {truncateAddress(r.address)}
                  </td>
                  <td className="px-3 py-2 text-right mono">
                    {Number(r.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {!res || res.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Pending
                      </span>
                    ) : res.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-destructive"
                        title={res.error}
                      >
                        <XCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
        Gas units estimated at ~65k per recipient. Settled in USDC.
      </p>
      <p className="sr-only">{formatUsdcPrecise(0)}</p>
    </div>
  );
}
