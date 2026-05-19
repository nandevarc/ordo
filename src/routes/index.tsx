import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
          <span className="pill mb-8">Batch payment infrastructure</span>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Batch USDC payments on Arc
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Upload a list. Preview the cost. Execute in one operation. Gas
            settled in USDC — no native token required.
          </p>

          <div className="mt-10 flex justify-center">
            {isConnected ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/create"
                  className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  New batch
                </Link>
                <Link
                  to="/history"
                  className="inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-6 text-sm font-medium text-foreground hover:bg-accent"
                >
                  View history
                </Link>
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Connect wallet to start
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>

          <div className="mt-20 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {[
              {
                k: "CSV in",
                v: "Upload addresses + amounts, inline edit, validation per row.",
              },
              {
                k: "One operation",
                v: "Multicall3 aggregates every transfer into a single transaction.",
              },
              {
                k: "USDC gas",
                v: "Pay gas in the same token you transfer. No ETH required.",
              },
            ].map((f) => (
              <div key={f.k} className="card-flat p-5">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {f.k}
                </div>
                <p className="mt-2 text-sm text-foreground">{f.v}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
