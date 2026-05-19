import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";

import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { supabase } from "@/integrations/supabase/client";
import { arcTestnet } from "@/lib/chain";
import { formatUsdc, truncateAddress } from "@/lib/format";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Batch history — Ordo" }] }),
  component: HistoryPage,
});

type BatchRow = {
  id: string;
  wallet_address: string;
  batch_name: string | null;
  total_amount: number;
  recipient_count: number;
  successful_count: number;
  failed_count: number;
  status: string;
  tx_hash: string | null;
  created_at: string;
};

type RecipientRow = {
  id: string;
  wallet_address: string;
  amount: number;
  note: string | null;
  status: string;
};

function HistoryPage() {
  const { address, isConnected } = useAccount();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches", address?.toLowerCase()],
    queryFn: async (): Promise<BatchRow[]> => {
      if (!address) return [];
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("wallet_address", address.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BatchRow[];
    },
    enabled: !!address,
  });

  const filtered = (batches ?? []).filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.batch_name?.toLowerCase().includes(s) ||
      b.tx_hash?.toLowerCase().includes(s) ||
      b.wallet_address.toLowerCase().includes(s)
    );
  });

  function exportAll() {
    const lines = [
      "date,name,recipients,total_usdc,success,failed,status,tx_hash",
    ];
    filtered.forEach((b) => {
      lines.push(
        [
          b.created_at,
          (b.batch_name ?? "Unnamed Batch").replace(/,/g, " "),
          b.recipient_count,
          b.total_amount,
          b.successful_count,
          b.failed_count,
          b.status,
          b.tx_hash ?? "",
        ].join(","),
      );
    });
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordo-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Batch history
            </h1>
            <p className="mt-1 text-xs text-muted-foreground mono">
              {isConnected ? truncateAddress(address!, 8, 6) : "Connect wallet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, tx, address"
                className="h-9 w-64 rounded-md border border-border bg-surface pl-8 pr-3 text-sm outline-none focus:border-border-strong"
              />
            </div>
            <button
              onClick={exportAll}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm hover:bg-accent"
            >
              Export
            </button>
          </div>
        </div>

        <div className="mt-6 card-flat overflow-hidden">
          {!isConnected ? (
            <Empty
              title="Connect your wallet"
              body="Connect a wallet to view your batch history."
            />
          ) : isLoading ? (
            <div className="p-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="my-2 h-8 animate-pulse rounded bg-surface-muted"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty
              title="No batches yet"
              body="Create your first batch to see it listed here."
              cta={
                <Link
                  to="/create"
                  className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
                >
                  New batch
                </Link>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Recipients
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Success</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <BatchRowView
                    key={b.id}
                    batch={b}
                    expanded={expanded === b.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === b.id ? null : b.id))
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function BatchRowView({
  batch,
  expanded,
  onToggle,
}: {
  batch: BatchRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [recipients, setRecipients] = useState<RecipientRow[] | null>(null);
  useEffect(() => {
    if (!expanded || recipients) return;
    void (async () => {
      const { data } = await supabase
        .from("recipients")
        .select("id, wallet_address, amount, note, status")
        .eq("batch_id", batch.id)
        .order("created_at", { ascending: true });
      setRecipients((data as RecipientRow[]) ?? []);
    })();
  }, [expanded, recipients, batch.id]);

  const date = new Date(batch.created_at);
  const dateStr = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-2 py-2">
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{dateStr}</td>
        <td className="px-3 py-2 text-sm">
          {batch.batch_name || (
            <span className="text-muted-foreground">Unnamed Batch</span>
          )}
        </td>
        <td className="px-3 py-2 text-right mono text-xs">
          {batch.recipient_count}
        </td>
        <td className="px-3 py-2 text-right mono text-xs">
          {formatUsdc(batch.total_amount)}
        </td>
        <td className="px-3 py-2 text-right mono text-xs">
          {batch.successful_count}/{batch.recipient_count}
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={batch.status} />
        </td>
        <td className="px-3 py-2">
          {batch.tx_hash ? (
            <a
              href={`${arcTestnet.blockExplorers.default.url}/tx/${batch.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {truncateAddress(batch.tx_hash, 6, 4)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-muted">
          <td colSpan={8} className="px-6 py-4">
            {!recipients ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : recipients.length === 0 ? (
              <div className="text-xs text-muted-foreground">No recipients.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Address</th>
                    <th className="px-2 py-1 text-right font-medium">Amount</th>
                    <th className="px-2 py-1 text-left font-medium">Note</th>
                    <th className="px-2 py-1 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-2 py-1 mono">
                        {truncateAddress(r.wallet_address)}
                      </td>
                      <td className="px-2 py-1 text-right mono">
                        {Number(r.amount).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {r.note || "—"}
                      </td>
                      <td className="px-2 py-1">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "border-success/30 bg-success/5 text-success",
    success: "border-success/30 bg-success/5 text-success",
    partial: "border-warning/30 bg-warning/10 text-warning-foreground",
    failed: "border-destructive/30 bg-destructive/5 text-destructive",
    pending: "border-border bg-surface text-muted-foreground",
  };
  const cls =
    map[status] ?? "border-border bg-surface text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}
    >
      {status}
    </span>
  );
}

function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 h-10 w-10 rounded-full border border-border bg-surface-muted" />
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
      {cta}
    </div>
  );
}
