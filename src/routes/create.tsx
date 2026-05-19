import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import Papa from "papaparse";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { Trash2, Plus, Upload, AlertCircle } from "lucide-react";

import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { StepIndicator } from "@/components/step-indicator";
import { useBatchStore } from "@/lib/batch-store";
import { validateRows, isRowValid } from "@/lib/validate";
import { USDC_ABI, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";
import { formatUsdc } from "@/lib/format";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "New batch — Ordo" },
      { name: "description", content: "Upload a CSV of USDC recipients." },
    ],
  }),
  component: CreatePage,
});

const STEPS = ["Upload", "Preview", "Execute"];

function CreatePage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const {
    rows,
    batchName,
    setRows,
    setBatchName,
    addRow,
    updateRow,
    removeRow,
  } = useBatchStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: balanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const balance = balanceRaw
    ? Number(formatUnits(balanceRaw, USDC_DECIMALS))
    : 0;

  const validations = useMemo(() => validateRows(rows), [rows]);
  const validCount = rows.filter((r) => isRowValid(validations[r.id])).length;
  const errorCount = rows.filter(
    (r) => r.address || r.amount || r.note,
  ).filter((r) => !isRowValid(validations[r.id])).length;
  const total = rows.reduce(
    (acc, r) => (isRowValid(validations[r.id]) ? acc + Number(r.amount) : acc),
    0,
  );
  const insufficient = total > balance;
  const canContinue =
    isConnected && validCount > 0 && errorCount === 0 && !insufficient;

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const next = res.data
          .map((r) => ({
            id: crypto.randomUUID(),
            address: (r.address ?? r.Address ?? "").trim(),
            amount: String(r.amount ?? r.Amount ?? "").trim(),
            note: (r.note ?? r.Note ?? "").trim(),
          }))
          .filter((r) => r.address || r.amount);
        setRows(next);
        toast.success(`Loaded ${next.length} rows from ${file.name}`);
      },
      error: (err) => toast.error(`CSV error: ${err.message}`),
    });
  }

  function downloadTemplate() {
    const csv =
      "address,amount,note\n0x0000000000000000000000000000000000000000,10.00,Example payment\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ordo-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <StepIndicator current={1} labels={STEPS} />

        <div className="mt-6 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create batch
          </h1>
          <input
            type="text"
            placeholder="Batch name (optional)"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            className="mt-3 w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("bg-accent");
              }}
              onDragLeave={(e) =>
                e.currentTarget.classList.remove("bg-accent")
              }
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("bg-accent");
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface px-8 py-10 text-center transition-colors hover:bg-accent"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="mt-3 text-sm text-foreground">
                Drop a CSV here, or click to select
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Columns: address, amount, note
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <button
              onClick={downloadTemplate}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Download CSV template
            </button>

            <div className="card-flat overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-10">#</th>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium w-32">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                    <th className="px-3 py-2 text-left font-medium w-20">
                      Status
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        No recipients yet. Upload a CSV or add a row manually.
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => {
                    const v = validations[r.id];
                    const invalid = v && !isRowValid(v);
                    const empty = !r.address && !r.amount && !r.note;
                    const showError = !empty && invalid;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border last:border-0 ${
                          showError ? "bg-destructive/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-muted-foreground mono">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={r.address}
                            onChange={(e) =>
                              updateRow(r.id, { address: e.target.value })
                            }
                            placeholder="0x..."
                            className="w-full rounded border border-transparent bg-transparent px-2 py-1 mono text-xs outline-none focus:border-border focus:bg-surface"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={r.amount}
                            onChange={(e) =>
                              updateRow(r.id, { amount: e.target.value })
                            }
                            placeholder="0.00"
                            className="w-full rounded border border-transparent bg-transparent px-2 py-1 mono text-xs outline-none focus:border-border focus:bg-surface"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={r.note}
                            onChange={(e) =>
                              updateRow(r.id, { note: e.target.value })
                            }
                            placeholder="—"
                            className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-xs outline-none focus:border-border focus:bg-surface"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {empty ? (
                            <span className="text-muted-foreground">—</span>
                          ) : showError ? (
                            <span
                              className="inline-flex items-center gap-1 text-destructive"
                              title={v?.errors.join(", ")}
                            >
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </span>
                          ) : v?.duplicate ? (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertCircle className="h-3 w-3" />
                              Duplicate
                            </span>
                          ) : (
                            <span className="text-success">Valid</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeRow(r.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-border p-2">
                <button
                  onClick={addRow}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card-flat sticky top-4 p-5">
              <h3 className="text-sm font-medium text-foreground">Summary</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <Stat label="Valid recipients" value={validCount.toString()} />
                <Stat
                  label="Rows with errors"
                  value={errorCount.toString()}
                  tone={errorCount > 0 ? "danger" : undefined}
                />
                <div className="my-2 h-px bg-border" />
                <Stat
                  label="Total USDC"
                  value={formatUsdc(total)}
                  mono
                  strong
                />
                <Stat
                  label="Your balance"
                  value={isConnected ? `${formatUsdc(balance)}` : "—"}
                  mono
                />
              </dl>

              {insufficient && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Insufficient USDC balance for this batch.
                </div>
              )}
              {!isConnected && (
                <div className="mt-4 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                  Connect a wallet to read your USDC balance.
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-accent"
          >
            Back
          </Link>
          <button
            disabled={!canContinue}
            onClick={() => navigate({ to: "/preview" })}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to preview
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  strong,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={[
          mono ? "mono" : "",
          strong ? "text-foreground font-semibold" : "text-foreground",
          tone === "danger" ? "text-destructive" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
