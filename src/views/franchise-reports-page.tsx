"use client";

import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ReadOnlyBanner, Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useFranchiseScope } from "@/hooks/use-franchise";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";

type AttRow = { school_id: string; school_name: string; att_date: string; marked: number; present: number; absent: number; late: number; leave: number };
type FunnelRow = { school_id: string; school_name: string; new_count: number; contacted_count: number; visited_count: number; applied_count: number; admitted_count: number; lost_count: number; total_count: number; conversion_pct: number };
type EnrolRow = { school_id: string; school_name: string; class_id: string; class_name: string; section: string; total_count: number; boys_count: number; girls_count: number; other_count: number };
type CompRow = { school_id: string; name: string; code: string; status: string; student_count: number; teacher_count: number; has_principal: boolean; attendance_pct_30d: number | null; classes_without_attendance_today: number; open_enquiries: number; admitted_30d: number; last_activity_at: string | null };

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-IN");
const today = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
const daysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };

type Tab = "attendance" | "enrolment" | "admissions" | "comparison";

export function FranchiseReportsPage() {
  const { franchiseId, readOnly, preview, error: ctxError, scope } = useFranchiseScope();
  const [tab, setTab] = useState<Tab>("attendance");
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());

  const attQuery = useQuery<AttRow[], Error>({
    queryKey: ["franchise-att-report", franchiseId, dateFrom, dateTo],
    enabled: !!franchiseId && tab === "attendance",
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_attendance_report", { _franchise_id: franchiseId, _from: dateFrom, _to: dateTo });
      if (e) throw e;
      return (data ?? []) as AttRow[];
    },
  });

  const funnelQuery = useQuery<FunnelRow[], Error>({
    queryKey: ["franchise-funnel-report", franchiseId, dateFrom, dateTo],
    enabled: !!franchiseId && tab === "admissions",
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_admissions_funnel", { _franchise_id: franchiseId, _from: dateFrom, _to: dateTo });
      if (e) throw e;
      return (data ?? []) as FunnelRow[];
    },
  });

  const enrolQuery = useQuery<EnrolRow[], Error>({
    queryKey: ["franchise-enrol-report", franchiseId],
    enabled: !!franchiseId && tab === "enrolment",
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_enrolment_report", { _franchise_id: franchiseId });
      if (e) throw e;
      return (data ?? []) as EnrolRow[];
    },
  });

  const compQuery = useQuery<CompRow[], Error>({
    queryKey: ["franchise-comp-report", franchiseId],
    enabled: !!franchiseId && tab === "comparison",
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_school_comparison", { _franchise_id: franchiseId });
      if (e) throw e;
      return (data ?? []) as CompRow[];
    },
  });

  const exportCsv = () => {
    if (tab === "attendance" && attQuery.data?.length) {
      downloadCsv("franchise-attendance.csv", ["School", "Date", "Marked", "Present", "Absent", "Late", "Leave"],
        attQuery.data.map((r) => [r.school_name, r.att_date, r.marked, r.present, r.absent, r.late, r.leave]));
    } else if (tab === "admissions" && funnelQuery.data?.length) {
      downloadCsv("franchise-admissions.csv", ["School", "New", "Contacted", "Visited", "Applied", "Admitted", "Lost", "Total", "Conversion %"],
        funnelQuery.data.map((r) => [r.school_name, r.new_count, r.contacted_count, r.visited_count, r.applied_count, r.admitted_count, r.lost_count, r.total_count, r.conversion_pct]));
    } else if (tab === "enrolment" && enrolQuery.data?.length) {
      downloadCsv("franchise-enrolment.csv", ["School", "Class", "Section", "Total", "Boys", "Girls", "Other"],
        enrolQuery.data.map((r) => [r.school_name, r.class_name, r.section, r.total_count, r.boys_count, r.girls_count, r.other_count]));
    } else if (tab === "comparison" && compQuery.data?.length) {
      downloadCsv("franchise-comparison.csv", ["School", "Code", "Status", "Students", "Teachers", "Principal", "Attendance 30d %", "Open Enquiries", "Admitted 30d"],
        compQuery.data.map((r) => [r.name, r.code, r.status, r.student_count, r.teacher_count, r.has_principal ? "Yes" : "No", r.attendance_pct_30d ?? "", r.open_enquiries, r.admitted_30d]));
    }
  };

  return (
    <AppShell title="Reports" subtitle={scope?.name ?? "Franchise"}>
      <div className="space-y-6">
        {readOnly && <ReadOnlyBanner visible />}
        {preview && <div role="status" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-medium">Preview mode — read-only.</div>}
        {ctxError && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{ctxError}</div>}

        <div className="flex flex-wrap items-center gap-3">
          {(["attendance", "enrolment", "admissions", "comparison"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          {(tab === "attendance" || tab === "admissions") && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
              <span className="text-muted-foreground">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>

        {/* Attendance tab */}
        {tab === "attendance" && (
          <Panel>
            {attQuery.isPending ? <p className="text-sm text-muted-foreground">Loading attendance data…</p>
              : (attQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-4 font-display text-base font-semibold">No attendance records</p>
                  <p className="mt-1 text-sm text-muted-foreground">Adjust the date range or wait for schools to mark attendance.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-3 font-medium">School</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Marked</th><th className="px-4 py-3 font-medium">Present</th><th className="px-4 py-3 font-medium">Absent</th><th className="px-4 py-3 font-medium">Late</th><th className="px-4 py-3 font-medium">Leave</th></tr>
                    </thead>
                    <tbody>
                      {attQuery.data!.map((r, i) => (
                        <tr key={`${r.school_id}-${r.att_date}-${i}`} className="border-t border-border">
                          <td className="px-4 py-3">{r.school_name}</td>
                          <td className="px-4 py-3">{r.att_date}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.marked)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.present)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.absent)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.late)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.leave)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Panel>
        )}

        {/* Enrolment tab */}
        {tab === "enrolment" && (
          <Panel>
            {enrolQuery.isPending ? <p className="text-sm text-muted-foreground">Loading enrolment data…</p>
              : (enrolQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-4 font-display text-base font-semibold">No enrolment data</p>
                  <p className="mt-1 text-sm text-muted-foreground">Classes and students need to be set up first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-3 font-medium">School</th><th className="px-4 py-3 font-medium">Class</th><th className="px-4 py-3 font-medium">Section</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Boys</th><th className="px-4 py-3 font-medium">Girls</th><th className="px-4 py-3 font-medium">Other</th></tr>
                    </thead>
                    <tbody>
                      {enrolQuery.data!.map((r) => (
                        <tr key={`${r.school_id}-${r.class_id}`} className="border-t border-border">
                          <td className="px-4 py-3">{r.school_name}</td>
                          <td className="px-4 py-3">{r.class_name}</td>
                          <td className="px-4 py-3">{r.section}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.total_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.boys_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.girls_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.other_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Panel>
        )}

        {/* Admissions funnel tab */}
        {tab === "admissions" && (
          <Panel>
            {funnelQuery.isPending ? <p className="text-sm text-muted-foreground">Loading admissions data…</p>
              : (funnelQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-4 font-display text-base font-semibold">No admissions data</p>
                  <p className="mt-1 text-sm text-muted-foreground">Adjust the date range or wait for enquiry activity.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-3 font-medium">School</th><th className="px-4 py-3 font-medium">New</th><th className="px-4 py-3 font-medium">Contacted</th><th className="px-4 py-3 font-medium">Visited</th><th className="px-4 py-3 font-medium">Applied</th><th className="px-4 py-3 font-medium">Admitted</th><th className="px-4 py-3 font-medium">Lost</th><th className="px-4 py-3 font-medium">Conv. %</th></tr>
                    </thead>
                    <tbody>
                      {funnelQuery.data!.map((r) => (
                        <tr key={r.school_id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">{r.school_name}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.new_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.contacted_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.visited_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.applied_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.admitted_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.lost_count)}</td>
                          <td className="px-4 py-3 tabular-nums"><Pill tone={r.conversion_pct >= 50 ? "navy" : r.conversion_pct > 0 ? "muted" : "red"}>{r.conversion_pct}%</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Panel>
        )}

        {/* Comparison tab */}
        {tab === "comparison" && (
          <Panel>
            {compQuery.isPending ? <p className="text-sm text-muted-foreground">Loading comparison…</p>
              : (compQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-4 font-display text-base font-semibold">No school data</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="px-4 py-3 font-medium">School</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Students</th><th className="px-4 py-3 font-medium">Teachers</th><th className="px-4 py-3 font-medium">Principal</th><th className="px-4 py-3 font-medium">Att. 30d</th><th className="px-4 py-3 font-medium">Enquiries</th><th className="px-4 py-3 font-medium">Admitted 30d</th></tr>
                    </thead>
                    <tbody>
                      {compQuery.data!.map((r) => (
                        <tr key={r.school_id} className="border-t border-border">
                          <td className="px-4 py-3"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code}</p></td>
                          <td className="px-4 py-3"><Pill tone={r.status === "active" ? "navy" : r.status === "rejected" ? "red" : "muted"}>{r.status}</Pill></td>
                          <td className="px-4 py-3 tabular-nums">{n(r.student_count)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.teacher_count)}</td>
                          <td className="px-4 py-3">{r.has_principal ? <Pill tone="navy">Yes</Pill> : <Pill tone="red">No</Pill>}</td>
                          <td className="px-4 py-3 tabular-nums">{r.attendance_pct_30d != null ? `${r.attendance_pct_30d}%` : "—"}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.open_enquiries)}</td>
                          <td className="px-4 py-3 tabular-nums">{n(r.admitted_30d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
