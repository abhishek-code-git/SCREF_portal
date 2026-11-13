import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string | undefined }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/centennial-logo.png"
      alt="The Centennial School emblem"
      className={cn("h-10 w-10 rounded-md object-contain", className)}
    />
  );
}

export function BrandLockup({
  className,
  subtitle = "Digital Operating Platform",
  invert = false,
}: {
  className?: string;
  subtitle?: string;
  invert?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={invert ? "bg-card/95 p-0.5" : undefined} />
      <div className="leading-tight">
        <p
          className={cn(
            "font-display text-sm font-semibold tracking-tight",
            invert ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          The Centennial School
        </p>
        <p
          className={cn(
            "text-[11px] uppercase tracking-[0.14em]",
            invert ? "text-sidebar-foreground/60" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
