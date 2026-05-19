import { Link } from "@tanstack/react-router";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Ordo
          </Link>
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Arc Testnet
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            to="/create"
            className="text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-sm text-foreground font-medium" }}
          >
            New batch
          </Link>
          <Link
            to="/history"
            className="text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-sm text-foreground font-medium" }}
          >
            History
          </Link>
          <ConnectButton
            showBalance={false}
            chainStatus="none"
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
          />
        </nav>
      </div>
    </header>
  );
}
