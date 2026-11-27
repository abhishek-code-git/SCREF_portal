"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/school-data";

type TabId = "attendance" | "enrolment" | "results" | "admissions";

type AttReportRow = {
  class_id: string;
  class_name: string;
  section: string;
  att_date: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  marked_count: number;
};

type StudentAttPctRow = {
  student_id: string;
  admission_no: string | null;
  full_name: string;
  roll_no: number;
  class_id: string;
  class_name: string;
  section: string;
  present_days: number;
  total_marked_days: number;
  attendance_pct: number | null;
};

type EnrolmentRow = {
  class_id: string;
  class_name: string;
  section: string;
  total_count: number;
  boys_count: number;
  girls_count: number;
  other_count: number;
};

type ExamResultRow = {
  student_id: string;
  admission_no: string | null;
  roll_no: number;
  full_name: string;
  total_obtained: number;
  total_max: number;
  percentage: number;
  exam_rank: number | null;
  subjects_entered: number;
};

type AdmissionsFunnelRow = { stage: string; count: number };

export function ReportsPage() {
  const { activeSchool, ready, error: accessError } = useSchoolContext();

  const [tab, setTab] = useState<TabId>("attendance");
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(todayISO);
  const [below75Only, setBelow75Only] = useState(false);

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");

  const metaQuery = useQuery({
    queryKey: ["reports-meta", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      const [exRes, clsRes] = await Promise.all([
        supabase.from("exams").select("id,name,status").eq("school_id", activeSchool.id).order("created_at", { ascending: false }),
        supabase.from("classes").select("id,name,section").eq("school_id", activeSchool.id).order("name").order("section"),
      ]);
      const err = exRes.error ?? clsRes.error;
      if (err) throw err;
      return {
        exams: (exRes.data ?? []) as Array<{ id: string; name: string; status: string }>,
        classes: (clsRes.data ?? []) as Array<{ id: string; name: string; section: string }>,
      };
    },
  });

  const attReportQuery = useQuery({
    queryKey: ["reports-attendance", activeSchool?.id, fromDate, toDate],
    enabled: !!activeSchool && tab === "attendance",
    queryFn: async () => {
      if (!activeSchool) return { byClass: [] as AttReportRow[], byStudent: [] as StudentAttPctRow[] };
      const [cRes, sRes] = await Promise.all([
        supabase.rpc("attendance_report", { _school_id: activeSchool.id, _from: fromDate, _to: toDate }),
        supabase.rpc("student_attendance_percentage", { _school_id: activeSchool.id, _from: fromDate, _to: toDate }),
      ]);
      const err = cRes.error ?? sRes.error;
      if (err) throw err;
      return {
        byClass: (cRes.data ?? []) as AttReportRow[],
        byStudent: (sRes.data ?? []) as StudentAttPctRow[],
      };
    },
  });

  const enrolmentQuery = useQuery<EnrolmentRow[], Error>({
    queryKey: ["reports-enrolment", activeSchool?.id],
    enabled: !!activeSchool && tab === "enrolment",
    queryFn: async () => {
      if (!activeSchool) return [];
      const { data, error } = await supabase.rpc("enrolment_report", { _school_id: activeSchool.id });
      if (error) throw error;
      return (data ?? []) as EnrolmentRow[];
    },
  });

  const selectedExamId = examId || metaQuery.data?.exams[0]?.id || "";
  const selectedClassId = classId || metaQuery.data?.classes[0]?.id || "";

  const resultsQuery = useQuery<ExamResultRow[], Error>({
    queryKey: ["reports-results", activeSchool?.id, selectedExamId, selectedClassId],
    enabled: !!activeSchool && tab === "results" && !!selectedExamId && !!selectedClassId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exam_result_summary", {
        _exam_id: selectedExamId,
        _class_id: selectedClassId,
      });
      if (error) throw error;
      return (data ?? []) as ExamResultRow[];
    },
  });

  const admissionsQuery = useQuery<AdmissionsFunnelRow[], Error>({
    queryKey: ["reports-admissions", activeSchool?.id],
    enabled: !!activeSchool && tab === "admissions",
    queryFn: async () => {
      if (!activeSchool) return [];
      const stages = ["new", "contacted", "visit_scheduled", "applied", "enrolled", "lost"];
      const counts = await Promise.all(
        stages.map((st) =>
          supabase
            .from("admission_enquiries")
            .select("id", { count: "exact", head: true })
            .eq("school_id", activeSchool.id)
            .eq("stage", st),
        ),
      );
      const err = counts.find((c) => c.error)?.error;
      if (err) throw err;
      return stages.map((st, idx) => ({ stage: st, count: counts[idx]?.count ?? 0 }));
    },
  });

  if (!ready) return <AppShell title="Reports"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Reports"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Reports"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const studentAttRows = (attReportQuery.data?.byStudent ?? []).filter((r) =>
    below75Only ? r.attendance_pct !== null && r.attendance_pct < 75 : true,
  );

  const exportAttendanceClassCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    downloadCsv(
      `attendance-by-class-${fromDate}-to-${toDate}.csv`,
      ["Date", "Class", "Present", "Absent", "Late", "Leave", "Marked"],
      (attReportQuery.data?.byClass ?? []).map((r) => [
        r.att_date,
        `${r.class_name}-${r.section}`,
        r.present_count,
        r.absent_count,
        r.late_count,
        r.leave_count,
        r.marked_count,
      ]),
    );
  };

  const exportAttendanceStudentCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    downloadCsv(
      `student-attendance-${fromDate}-to-${toDate}.csv`,
      ["Admission No", "Roll", "Student", "Class", "Present Days", "Total Marked", "Attendance %"],
      studentAttRows.map((r) => [
        r.admission_no,
        r.roll_no,
        r.full_name,
        `${r.class_name}-${r.section}`,
        r.present_days,
        r.total_marked_days,
        r.attendance_pct,
      ]),
    );
  };

  const exportEnrolmentCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    downloadCsv(
      `enrolment-report-${todayISO()}.csv`,
      ["Class", "Section", "Total", "Boys", "Girls", "Other / Unspecified"],
      (enrolmentQuery.data ?? []).map((r) => [
        r.class_name,
        r.section,
        r.total_count,
        r.boys_count,
        r.girls_count,
        r.other_count,
      ]),
    );
  };

  const exportResultsCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    downloadCsv(
      `exam-results-${todayISO()}.csv`,
      ["Rank", "Admission No", "Roll", "Student", "Subjects", "Obtained", "Max", "Percentage"],
      (resultsQuery.data ?? []).map((r) => [
        r.exam_rank,
        r.admission_no,
        r.roll_no,
        r.full_name,
        r.subjects_entered,
        r.total_obtained,
        r.total_max,
        r.percentage,
      ]),
    );
  };

  const exportAdmissionsCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    downloadCsv(
      `admissions-funnel-${todayISO()}.csv`,
      ["Stage", "Count"],
      (admissionsQuery.data ?? []).map((r) => [r.stage, r.count]),
    );
  };

  return (
    <AppShell title="Reports" subtitle={`${activeSchool.name} · Live school reports & CSV export`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Reports" }]} />

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["attendance", "Attendance"],
              ["enrolment", "Enrolment"],
              ["results", "Results"],
              ["admissions", "Admissions"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === "attendance" && (
          <div className="space-y-6">
            <Panel title="Date range" subtitle="Aggregated server-side via attendance report RPCs">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={toDate} max={todayISO()} onChange={(e) => setToDate(e.target.value)} className="w-44" />
                </div>
                <label className="inline-flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={below75Only} onChange={(e) => setBelow75Only(e.target.checked)} />
                  Below 75% only
                </label>
              </div>
            </Panel>

            <Panel
              title="By class & date"
              action={
                <Button size="sm" variant="outline" onClick={() => void exportAttendanceClassCsv()}>
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
              }
            >
              {attReportQuery.isPending ? (
                <p className="py-4 text-sm text-muted-foreground">Loading…</p>
              ) : attReportQuery.error ? (
                <p role="alert" className="py-4 text-sm text-destructive">{attReportQuery.error.message}</p>
              ) : (attReportQuery.data?.byClass.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No attendance records in this date range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b border-border bg-surface text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="px-3 py-2 text-right font-medium">Present</th>
                        <th className="px-3 py-2 text-right font-medium">Absent</th>
                        <th className="px-3 py-2 text-right font-medium">Late</th>
                        <th className="px-3 py-2 text-right font-medium">Leave</th>
                        <th className="px-3 py-2 text-right font-medium">Marked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {attReportQuery.data!.byClass.map((r) => (
                        <tr key={`${r.class_id}-${r.att_date}`}>
                          <td className="px-3 py-2">{r.att_date}</td>
                          <td className="px-3 py-2 font-medium">
                            {r.class_name}-{r.section}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.present_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.absent_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.late_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.leave_count}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.marked_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Student attendance %"
              subtitle={`${studentAttRows.length} student(s)`}
              action={
                <Button size="sm" variant="outline" onClick={() => void exportAttendanceStudentCsv()}>
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
              }
            >
              {studentAttRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No matching student attendance records.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b border-border bg-surface text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Adm No</th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="px-3 py-2 text-right font-medium">Present</th>
                        <th className="px-3 py-2 text-right font-medium">Marked</th>
                        <th className="px-3 py-2 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {studentAttRows.map((r) => (
                        <tr key={r.student_id}>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.admission_no ?? "—"}</td>
                          <td className="px-3 py-2 font-medium">{r.full_name}</td>
                          <td className="px-3 py-2">
                            {r.class_name}-{r.section}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.present_days}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.total_marked_days}</td>
                          <td className="px-3 py-2 text-right">
                            {r.attendance_pct === null ? (
                              "—"
                            ) : (
                              <Pill tone={r.attendance_pct < 75 ? "red" : "navy"}>{r.attendance_pct}%</Pill>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}

        {tab === "enrolment" && (
          <Panel
            title="Enrolment by class & gender"
            action={
              <Button size="sm" variant="outline" onClick={() => void exportEnrolmentCsv()}>
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
            }
          >
            {enrolmentQuery.isPending ? (
              <p className="py-4 text-sm text-muted-foreground">Loading enrolment report…</p>
            ) : enrolmentQuery.error ? (
              <p role="alert" className="py-4 text-sm text-destructive">{enrolmentQuery.error.message}</p>
            ) : (enrolmentQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No classes configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead className="border-b border-border bg-surface text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Boys</th>
                      <th className="px-3 py-2 text-right font-medium">Girls</th>
                      <th className="px-3 py-2 text-right font-medium">Other / Unspecified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrolmentQuery.data!.map((r) => (
                      <tr key={r.class_id}>
                        <td className="px-3 py-2 font-medium">
                          {r.class_name}-{r.section}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total_count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.boys_count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.girls_count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.other_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {tab === "results" && (
          <Panel
            title="Exam results"
            action={
              <Button size="sm" variant="outline" disabled={!selectedExamId || !selectedClassId} onClick={() => void exportResultsCsv()}>
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Exam</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedExamId}
                  onChange={(e) => setExamId(e.target.value)}
                >
                  {(metaQuery.data?.exams ?? []).map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Class</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedClassId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {(metaQuery.data?.classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedExamId || !selectedClassId ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Create an exam and class first.</p>
            ) : resultsQuery.isPending ? (
              <p className="py-4 text-sm text-muted-foreground">Loading results…</p>
            ) : (resultsQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active students in this class.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="border-b border-border bg-surface text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Rank</th>
                      <th className="px-3 py-2 font-medium">Adm No</th>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 text-right font-medium">Subjects</th>
                      <th className="px-3 py-2 text-right font-medium">Marks</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resultsQuery.data!.map((r) => (
                      <tr key={r.student_id}>
                        <td className="px-3 py-2 font-semibold tabular-nums">{r.exam_rank ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.admission_no ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">{r.full_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.subjects_entered}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.total_obtained} / {r.total_max}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {tab === "admissions" && (
          <Panel
            title="Admissions funnel"
            action={
              <Button size="sm" variant="outline" onClick={() => void exportAdmissionsCsv()}>
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
            }
          >
            {admissionsQuery.isPending ? (
              <p className="py-4 text-sm text-muted-foreground">Loading admissions funnel…</p>
            ) : admissionsQuery.error ? (
              <p role="alert" className="py-4 text-sm text-destructive">{admissionsQuery.error.message}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead className="border-b border-border bg-surface text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 text-right font-medium">Enquiries</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(admissionsQuery.data ?? []).map((r) => (
                      <tr key={r.stage}>
                        <td className="px-3 py-2 font-medium capitalize">{r.stage.replace("_", " ")}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.count}</td>
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
