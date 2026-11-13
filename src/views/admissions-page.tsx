"use client";

import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { leads, stages } from "@/lib/demo-people";

export function AdmissionsPage() {
  return (
    <AppShell
      title="Admissions"
      subtitle="Enquiry to confirmed admission."
      actions={
        <>
          <DemoBadge />
          <Button size="sm" onClick={() => toast.success("New enquiry form opened")}>
            <FilePlus2 className="mr-2 h-4 w-4" /> New enquiry
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <StatGrid
          items={[
            ["Total enquiries", "312", "This academic year"],
            ["Follow-ups due", "19", "7 today"],
            ["Applications", "58", "12 in documentation"],
            ["Conversion rate", "45.5%", "142 admissions confirmed"],
          ]}
        />
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {stages.map((stage) => {
              const items = leads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="rounded-xl bg-surface p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold">{stage}</p>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((l) => (
                      <div key={l.child} className="rounded-lg border border-border bg-card p-3 shadow-card">
                        <p className="text-sm font-medium">{l.child}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.klass} · {l.parent}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">{l.phone}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{l.source}</span>
                          <span className="text-muted-foreground">Follow-up {l.followUp}</span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">Assigned: {l.assigned}</p>
                      </div>
                    ))}
                    {items.length === 0 && <p className="px-1 text-xs text-muted-foreground">No leads</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
