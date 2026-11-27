"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, PrincipalBreadcrumb, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, type AttStatus } from "@/lib/school-data";
import { cn } from "@/lib/utils";

type ReportRow = {
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

type ClassItem = { id: string; name: string; section: string };
type StudentRow = { id: string; full_name: string; roll_no: number };

const STATUSES: { key: AttStatus; label: string }[] = [
  { key: "present", label: "P" },
  { key: "absent", label: "A" },
  { key: "late", label: "L" },
  { key: "leave", label: "Lv" },
];

export function AttendancePage() {
  const { user, activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [attDate, setAttDate] = useState(todayISO());
  const [selectedClassId, setSelectedClassId] = useState("");
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});

  const summaryQuery = useQuery({
    queryKey: ["school-attendance-day", activeSchool?.id, attDate],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      const [clsRes, repRes] = await Promise.all([
        supabase.from("classes").select("id,name,section").eq("school_id", activeSchool.id).order("name").order("section"),
        supabase.rpc("attendance_report", { _school_id: activeSchool.id, _from: attDate, _to: attDate }),
      ]);
      const err = clsRes.error ?? repRes.error;
      if (err) throw err;
      return {
        classes: (clsRes.data ?? []) as ClassItem[],
        report: (repRes.data ?? []) as ReportRow[],
      };
    },
  });

  const activeClassId = selectedClassId || summaryQuery.data?.classes[0]?.id || "";

  const classDetailQuery = useQuery({
    queryKey: ["school-attendance-class", activeSchool?.id, activeClassId, attDate],
    enabled: !!activeSchool && !!activeClassId,
    queryFn: async () => {
      if (!activeSchool || !activeClassId) return { students: [] as StudentRow[], existing: {} as Record<string, AttStatus> };
      const [studRes, attRes] = await Promise.all([
        supabase
          .from("students")
          .select("id,full_name,roll_no")
          .eq("school_id", activeSchool.id)
          .eq("class_id", activeClassId)
          .eq("status", "active")
          .order("roll_no")
          .range(0, 499),
        supabase
          .from("attendance_records")
          .select("student_id,status")
          .eq("school_id", activeSchool.id)
          .eq("class_id", activeClassId)
          .eq("att_date", attDate)
          .range(0, 499),
      ]);
      const err = studRes.error ?? attRes.error;
      if (err) throw err;
      return {
        students: (studRes.data ?? []) as StudentRow[],
        existing: Object.fromEntries((attRes.data ?? []).map((r) => [r.student_id, r.status as AttStatus])),
      };
    },
  });

  useEffect(() => {
    if (classDetailQuery.data) {
      setMarks(classDetailQuery.data.existing);
    }
  }, [classDetailQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool || !activeClassId || !user) return;
      const students = classDetailQuery.data?.students ?? [];
      const rows = students
        .filter((s) => marks[s.id])
        .map((s) => ({
          school_id: activeSchool.id,
          class_id: activeClassId,
          student_id: s.id,
          att_date: attDate,
          status: marks[s.id]!,
          marked_by: user.id,
        }));
      if (rows.length === 0) throw new Error("Mark at least one student first");
      const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,att_date" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: async (count) => {
      toast.success(`Saved attendance for ${count ?? 0} student(s)`);
      await queryClient.invalidateQueries({ queryKey: ["school-attendance-day", activeSchool?.id, attDate] });
      await queryClient.invalidateQueries({ queryKey: ["school-attendance-class", activeSchool?.id, activeClassId, attDate] });
      await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Attendance"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Attendance"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Attendance"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const classes = summaryQuery.data?.classes ?? [];
  const reportRows = summaryQuery.data?.report ?? [];
  const totalMarked = reportRows.reduce((acc, r) => acc + r.marked_count, 0);
  const totalPresent = reportRows.reduce((acc, r) => acc + r.present_count, 0);
  const totalAbsent = reportRows.reduce((acc, r) => acc + r.absent_count, 0);
  const students = classDetailQuery.data?.students ?? [];

  return (
    <AppShell title="Attendance" subtitle={`${activeSchool.name} · Daily review & marking`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Attendance" }]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Date
              <Input
                type="date"
                max={todayISO()}
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="mt-1 w-44"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Inspect / mark class
              <select
                className="mt-1 block h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={activeClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}-{c.section}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <StatGrid
          items={[
            ["Marked", String(totalMarked), `On ${attDate}`],
            ["Present", String(totalPresent), totalMarked > 0 ? `${Math.round((totalPresent / totalMarked) * 100)}%` : "—"],
            ["Absent", String(totalAbsent), "Across all marked classes"],
            ["Classes marked", `${reportRows.length} / ${classes.length}`, "For selected date"],
          ]}
        />

        <Panel title="Class-wise summary" subtitle={`Attendance recorded on ${attDate}`}>
          {summaryQuery.isPending ? (
            <p className="py-4 text-sm text-muted-foreground">Loading attendance summary…</p>
          ) : summaryQuery.error ? (
            <p role="alert" className="py-4 text-sm text-destructive">{summaryQuery.error.message}</p>
          ) : classes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No classes created yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((c) => {
                const rep = reportRows.find((r) => r.class_id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      activeClassId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {c.name}-{c.section}
                      </span>
                      <Pill tone={rep ? "navy" : "muted"}>
                        {rep ? `${rep.present_count}/${rep.marked_count} present` : "Not marked"}
                      </Pill>
                    </div>
                    {rep && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        A: {rep.absent_count} · L: {rep.late_count} · Lv: {rep.leave_count}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        {activeClassId && (
          <Panel
            title="Class register"
            subtitle={
              classes.find((c) => c.id === activeClassId)
                ? `${classes.find((c) => c.id === activeClassId)!.name}-${classes.find((c) => c.id === activeClassId)!.section} · ${attDate}`
                : ""
            }
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isWritable || students.length === 0}
                  onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "present" as AttStatus])))}
                >
                  <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all present
                </Button>
                <Button
                  size="sm"
                  disabled={!isWritable || students.length === 0 || saveMut.isPending}
                  onClick={() => saveMut.mutate()}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {saveMut.isPending ? "Saving…" : "Save attendance"}
                </Button>
              </div>
            }
          >
            {classDetailQuery.isPending ? (
              <p className="py-6 text-sm text-muted-foreground">Loading students…</p>
            ) : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active students in this class.</p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="text-sm font-medium">
                      {s.roll_no}. {s.full_name}
                    </span>
                    <div className="flex gap-1.5">
                      {STATUSES.map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          disabled={!isWritable}
                          onClick={() => setMarks((prev) => ({ ...prev, [s.id]: st.key }))}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                            marks[s.id] === st.key
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-secondary",
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
