"use client";

import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { DataTable, Pill, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { staff } from "@/lib/demo-people";

export function StaffPage() {
  return (
    <AppShell
      title="Staff"
      subtitle="Teaching, administrative and support staff."
      actions={
        <>
          <DemoBadge />
          <Button size="sm" onClick={() => toast.success("New staff form opened")}>
            <UserPlus className="mr-2 h-4 w-4" /> Add staff
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <StatGrid
          items={[
            ["Total staff", "96", "72 teachers"],
            ["Administrative", "14", "Office, finance, front desk"],
            ["Present today", "89", "92.7% attendance"],
            ["On leave", "4", "2 approved this week"],
          ]}
        />
        <DataTable
          rows={staff}
          placeholder="Search staff…"
          searchText={(s) => `${s.name} ${s.designation} ${s.department}`}
          filters={["Teaching", "Administrative", "Support"]}
          getFilter={(s) => s.type}
          columns={[
            { key: "n", label: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
            { key: "d", label: "Designation", render: (s) => s.designation },
            { key: "dep", label: "Department", render: (s) => <span className="text-muted-foreground">{s.department}</span> },
            { key: "c", label: "Contact", render: (s) => <span className="text-muted-foreground">{s.phone}</span> },
            { key: "a", label: "Attendance", render: (s) => <span className="tabular-nums">{s.attendance}%</span> },
            { key: "j", label: "Joined", render: (s) => s.joined },
            { key: "s", label: "Today", render: (s) => <Pill tone={s.status === "Present" ? "navy" : s.status === "Absent" ? "red" : "muted"}>{s.status}</Pill> },
          ]}
        />
      </div>
    </AppShell>
  );
}
