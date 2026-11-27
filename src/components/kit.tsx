import Link from "next/link";
import { ChevronRight, Download, Lock, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Pill({ tone = "muted", children }: { tone?: "navy" | "red" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "navy" && "bg-navy-soft text-navy",
        tone === "red" && "bg-crimson-soft text-destructive",
        tone === "muted" && "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-panel p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <p className="text-sm font-semibold">{title}</p>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode };

export function DataTable<T>({
  rows,
  columns,
  searchText,
  filters,
  getFilter,
  onRowClick,
  placeholder = "Search…",
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  filters?: string[];
  getFilter?: (row: T) => string;
  onRowClick?: (row: T) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          searchText(r).toLowerCase().includes(q.toLowerCase()) &&
          (filter === "All" || !getFilter || getFilter(r) === filter),
      ),
    [rows, q, filter, searchText, getFilter],
  );

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {filters && (
          <div className="flex flex-wrap gap-1">
            {["All", ...filters].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => toast.success("Export started")}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-t border-border transition-colors hover:bg-surface",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">No records match your search.</p>
        )}
      </div>
    </div>
  );
}

export function StatGrid({ items }: { items: [string, string, string?][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value, note]) => (
        <div key={label} className="surface-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  cta,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <div className="surface-panel flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-soft text-navy">{icon}</span>
      <p className="mt-4 font-display text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      <Button className="mt-5" onClick={() => toast.info("Integration request sent to Centennial head office")}>
        {cta}
      </Button>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

export function PrincipalBreadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Link href="/principal" className="hover:text-foreground hover:underline">
        Overview
      </Link>
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ReadOnlyBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="print:hidden flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="font-semibold text-foreground">This school is read only (suspended or inactive)</p>
        <p className="text-xs text-muted-foreground">
          You can view and export records, while creating, editing, and deleting data are disabled until your school and franchise are active.
        </p>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
