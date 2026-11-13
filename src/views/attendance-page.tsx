"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { attendanceByClass, attendanceToday } from "@/lib/demo-data";

const groups = [
  { key: "students", label: "Students" },
  { key: "teachers", label: "Teachers" },
  { key: "staff", label: "Staff" },
] as const;

export function AttendancePage() {
  return (
    <AppShell
      title="Attendance"
      subtitle="Today · Friday, 25 September 2026"
      actions={<DemoBadge />}
    >
      <div className="space-y-8">
        <section className="grid gap-4 lg:grid-cols-3">
          {groups.map(({ key, label }) => {
            const g = attendanceToday[key];
            const pct = ((g.present / g.total) * 100).toFixed(1);
            return (
              <div key={key} className="surface-panel p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="font-display text-2xl font-semibold tabular-nums">{pct}%</p>
                </div>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="bg-primary" style={{ width: `${(g.present / g.total) * 100}%` }} />
                  <div className="bg-destructive" style={{ width: `${(g.absent / g.total) * 100}%` }} />
                  <div className="bg-warning" style={{ width: `${(g.late / g.total) * 100}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Present", g.present],
                    ["Absent", g.absent],
                    ["Late", g.late],
                    ["Leave", g.leave],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-surface py-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="surface-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Class-wise attendance</p>
              <p className="text-xs text-muted-foreground">Present percentage across class groups</p>
            </div>
            <Button variant="outline" size="sm">
              Export attendance report
            </Button>
          </div>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceByClass}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="klass" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis domain={[80, 100]} tickLine={false} axisLine={false} fontSize={12} width={36} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Bar dataKey="present" name="Present %" fill="var(--chart-1)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-panel p-5">
          <p className="text-sm font-semibold">Attention needed</p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              "Class 9-B attendance below 88% for three consecutive days.",
              "2 teachers marked absent without a recorded leave request.",
              "14 students on approved leave — medical documents pending for 3.",
            ].map((item) => (
              <li key={item} className="flex gap-3 rounded-lg bg-surface p-3 text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
