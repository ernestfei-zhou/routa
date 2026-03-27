export function ProtocolBadge({
  name,
  endpoint,
}: {
  name: string;
  endpoint: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[11px] font-medium text-desktop-text-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {name}
      <span className="font-mono text-[10px] text-desktop-text-tertiary">
        {endpoint}
      </span>
    </div>
  );
}
