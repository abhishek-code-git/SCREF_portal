"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { DataTable, Panel, Pill, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { students } from "@/lib/demo-people";

const requests = [
  ["Bus stop change request", "Rohit Sharma", "Open"],
  ["Fee instalment extension", "Manish Gupta", "In review"],
  ["Leave application · 3 days", "Amit Verma", "Approved"],
];

export function ParentsPage() {
  return (
    <AppShell title="Parents" subtitle="Parent directory, requests and communication." actions={<DemoBadge />}>
      <div className="space-y-6">
        <StatGrid
          items={[
            ["Parent accounts", "1,094", "Portal active: 86%"],
            ["Open requests", "12", "4 due today"],
            ["Messages this week", "318", "Avg. reply 3h"],
            ["Pending fees", "62 families", "₹4.1L outstanding"],
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <DataTable
            rows={students}
            placeholder="Search parents or students…"
            searchText={(s) => `${s.parent} ${s.name}`}
            columns={[
              { key: "p", label: "Parent", render: (s) => <span className="font-medium">{s.parent}</span> },
              { key: "s", label: "Student", render: (s) => `${s.name} · ${s.klass}-${s.section}` },
              { key: "ph", label: "Phone", render: (s) => <span className="text-muted-foreground">{s.phone}</span> },
              { key: "f", label: "Fee", render: (s) => <Pill tone={s.fee === "Paid" ? "navy" : s.fee === "Overdue" ? "red" : "muted"}>{s.fee}</Pill> },
              {
                key: "a",
                label: "",
                render: (s) => (
                  <Button size="sm" variant="ghost" onClick={() => toast.success(`Message window opened for ${s.parent}`)}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                ),
              },
            ]}
          />
          <Panel
            title="Parent requests"
            subtitle="Raised through the parent portal"
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/communication">Message parents</Link>
              </Button>
            }
          >
            <ul className="space-y-3">
              {requests.map(([t, p, s]) => (
                <li key={t} className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3">
                  <div>
                    <p className="text-sm font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground">{p}</p>
                  </div>
                  <Pill tone={s === "Open" ? "red" : s === "Approved" ? "navy" : "muted"}>{s}</Pill>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
