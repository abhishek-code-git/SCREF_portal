"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { DataTable, Field, Pill, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { students, type Student } from "@/lib/demo-people";

const feeTone = (f: Student["fee"]) => (f === "Paid" ? "navy" : f === "Overdue" ? "red" : "muted");

export function StudentsPage() {
  const [selected, setSelected] = useState<Student | null>(null);

  return (
    <AppShell
      title="Students"
      subtitle="All enrolled students at this centre."
      actions={
        <>
          <DemoBadge />
          <Button size="sm" onClick={() => toast.success("New student form opened")}>
            <UserPlus className="mr-2 h-4 w-4" /> Add student
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <StatGrid
          items={[
            ["Enrolled", "1,248", "Across 42 sections"],
            ["New this year", "142", "+8.4% growth"],
            ["Transfers", "6", "2 awaiting approval"],
            ["Documents pending", "3", "Admission files incomplete"],
          ]}
        />
        <DataTable
          rows={students}
          placeholder="Search by name, ID or parent…"
          searchText={(s) => `${s.name} ${s.id} ${s.parent}`}
          filters={["Paid", "Pending", "Overdue"]}
          getFilter={(s) => s.fee}
          onRowClick={setSelected}
          columns={[
            { key: "id", label: "Student ID", render: (s) => <span className="text-muted-foreground">{s.id}</span> },
            { key: "name", label: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
            { key: "class", label: "Class", render: (s) => `${s.klass}-${s.section}` },
            { key: "roll", label: "Roll", render: (s) => s.roll },
            { key: "parent", label: "Parent", render: (s) => <span className="text-muted-foreground">{s.parent}</span> },
            { key: "att", label: "Attendance", render: (s) => <span className="tabular-nums">{s.attendance}%</span> },
            { key: "fee", label: "Fee", render: (s) => <Pill tone={feeTone(s.fee)}>{s.fee}</Pill> },
            { key: "tr", label: "Transport", render: (s) => <span className="text-muted-foreground">{s.transport}</span> },
            { key: "st", label: "Status", render: (s) => <Pill tone={s.status === "Active" ? "navy" : "red"}>{s.status}</Pill> },
          ]}
        />
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
                  {selected.name.split(" ").map((p) => p[0]).join("")}
                </span>
                <div>
                  <SheetTitle className="font-display">{selected.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {selected.id} · Class {selected.klass}-{selected.section}
                  </p>
                </div>
              </div>
              <ProfileBlock title="Basic information">
                <Field label="Roll no." value={selected.roll} />
                <Field label="Status" value={selected.status} />
                <Field label="Academic year" value="2026–27" />
                <Field label="Admission" value="Apr 2022" />
              </ProfileBlock>
              <ProfileBlock title="Parent information">
                <Field label="Parent" value={selected.parent} />
                <Field label="Phone" value={selected.phone} />
              </ProfileBlock>
              <ProfileBlock title="Attendance & fees">
                <Field label="Attendance" value={`${selected.attendance}%`} />
                <Field label="Fee status" value={<Pill tone={feeTone(selected.fee)}>{selected.fee}</Pill>} />
                <Field label="Transport" value={selected.transport} />
                <Field label="Documents" value="4 of 4 uploaded" />
              </ProfileBlock>
              <div>
                <p className="mb-2 text-sm font-semibold">Communication history</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="rounded-lg bg-surface p-3">24 Sep · Exam schedule notice delivered</li>
                  <li className="rounded-lg bg-surface p-3">18 Sep · Quarter 2 fee reminder sent</li>
                  <li className="rounded-lg bg-surface p-3">02 Sep · Parent–teacher meeting attended</li>
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function ProfileBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
