export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6 text-xs text-muted-foreground">
        <span>Built on Arc Network</span>
        <span className="mono">USDC · {`Chain 5042002`}</span>
      </div>
    </footer>
  );
}
