import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function useCountUp(target: number, decimals = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const total = 36;
    const id = setInterval(() => {
      frame += 1;
      const eased = 1 - Math.pow(1 - frame / total, 3);
      setValue(Number((target * eased).toFixed(decimals)));
      if (frame >= total) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, decimals]);
  return value;
}

export type MetricTone = "up" | "down" | "flat";

export function MetricCard({
  label,
  value,
  format = "number",
  delta,
  tone = "flat",
}: {
  label: string;
  value: number;
  format?: "number" | "percent" | "lakh";
  delta?: string;
  tone?: MetricTone;
}) {
  const decimals = format === "number" ? 0 : 1;
  const animated = useCountUp(value, decimals);
  const display =
    format === "lakh"
      ? `₹${animated.toFixed(1)}L`
      : format === "percent"
        ? `${animated.toFixed(1)}%`
        : Math.round(animated).toLocaleString("en-IN");

  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;

  return (
    <div className="surface-panel group p-5 transition-shadow duration-200 hover:shadow-lift">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-semibold text-foreground tabular-nums">
        {display}
      </p>
      {delta ? (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium",
            tone === "up" && "text-success",
            tone === "down" && "text-destructive",
            tone === "flat" && "text-muted-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {delta}
        </p>
      ) : null}
    </div>
  );
}
