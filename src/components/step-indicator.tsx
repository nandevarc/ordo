export function StepIndicator({
  current,
  total = 3,
  labels,
}: {
  current: number;
  total?: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="mono uppercase tracking-wider">
        Step {current} of {total}
      </span>
      <span>—</span>
      <span className="text-foreground font-medium">{labels[current - 1]}</span>
      <div className="ml-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1 w-8 rounded-full ${
              i < current ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
