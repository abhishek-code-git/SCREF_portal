"use client";

import { Eye, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { reportCategories } from "@/lib/demo-data";

export function ReportsPage() {
  return (
    <AppShell
      title="Reports & Insights"
      subtitle="Build, filter and export reports across every part of your centre."
      actions={<DemoBadge />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportCategories.map((cat) => (
            <div key={cat.name} className="surface-panel flex flex-col p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between">
                <p className="font-display text-sm font-semibold">{cat.name}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {cat.count}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{cat.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toast.info(`Opening ${cat.name}`)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast.info("Filters opened")}>
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast.success("PDF export queued")}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast.success("Excel export queued")}>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="surface-panel p-6">
          <p className="text-sm font-semibold">Scheduled management report</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A consolidated centre performance summary is prepared for the head office on the 1st of
            every month. The next report covers September 2026.
          </p>
          <Button className="mt-5" onClick={() => toast.success("Report generation started")}>
            Generate management report
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
