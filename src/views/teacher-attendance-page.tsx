"use client";

import { CheckCheck, Save, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, todayISO, type AttStatus, type StudentRow } from "@/lib/school-data";
import { cn } from "@/lib/utils";

const STATUSES: { key: AttStatus; label: string }[] = [
  { key: "present", label: "P" }, { key: "absent", label: "A" }, { key: "late", label: "L" }, { key: "leave", label: "Lv" },
];

type HistoryRow = { att_date: string; present: number; absent: number; late: number; leave: number; total: number };

export function TeacherAttendancePage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [savedMarks, setSavedMarks] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const selectedClass = classes.find((c) => c.id === classId);
  const dirty = useMemo(() => JSON.stringify(marks) !== JSON.stringify(savedMarks), [marks, savedMarks]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const loadClassRecords = useCallback(async () => {
    if (!selectedClass || !activeSchool) { setStudents([]); setMarks({}); setSavedMarks({}); return; }
    setLoading(true);
    const [studentResult, attendanceResult] = await Promise.all([
      supabase.from("students").select("id,full_name,roll_no,class_id").eq("class_id", selectedClass.id).order("roll_no"),
      supabase.from("attendance_records").select("student_id,status").eq("class_id", selectedClass.id).eq("att_date", date),
    ]);
    if (studentResult.error || attendanceResult.error) toast.error(`Unable to load: ${(studentResult.error ?? attendanceResult.error)?.message}`);
    setStudents((studentResult.data ?? []) as StudentRow[]);
    const m = Object.fromEntries((attendanceResult.data ?? []).map((r) => [r.student_id, r.status as AttStatus]));
    setMarks(m);
    setSavedMarks(m);

    // Load 7-day history
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const histRes = await supabase.from("attendance_records").select("att_date,status").eq("class_id", selectedClass.id).gte("att_date", sevenDaysAgo).lte("att_date", todayISO());
    const byDate: Record<string, { present: number; absent: number; late: number; leave: number; total: number }> = {};
    for (const rec of (histRes.data ?? [])) {
      const d = rec.att_date as string;
      if (!byDate[d]) byDate[d] = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
      byDate[d].total += 1;
      const s = rec.status as AttStatus;
      if (s in byDate[d]) byDate[d][s] += 1;
    }
    setHistory(Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([d, v]) => ({ att_date: d, ...v })));
    setLoading(false);
  }, [date, selectedClass, activeSchool]);

  useEffect(() => { void loadClassRecords(); }, [loadClassRecords]);

  const counts = useMemo(() => {
    const tally = { present: 0, absent: 0, late: 0, leave: 0 };
    Object.values(marks).forEach((s) => { tally[s] += 1; });
    return tally;
  }, [marks]);

  const save = async () => {
    if (!selectedClass || !user || !activeSchool || !students.length) return;
    const rows = students.filter((s) => marks[s.id]).map((s) => ({
      school_id: activeSchool.id, class_id: selectedClass.id, student_id: s.id, att_date: date, status: marks[s.id]!, marked_by: user.id,
    }));
    if (!rows.length) { toast.error("Mark at least one student first"); return; }
    setSaving(true);
    const { error: saveError } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,att_date" });
    setSaving(false);
    if (saveError) { toast.error(`Save failed: ${saveError.message}`); return; }
    toast.success(`Attendance saved for ${rows.length} students`);
    setSavedMarks({ ...marks });
  };

  if (!ready) return <AppShell title="Attendance"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Attendance"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Attendance"><Panel title="No school">Ask your principal to assign your account.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Attendance"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  return (
    <AppShell title="Attendance" subtitle={`${activeSchool.name} · Mark class attendance`}>
      <div className="space-y-6">
        {/* Class selector */}
        <Panel title="Select class">
          {classesLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : classes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No classes assigned. Ask your principal to assign a class.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((cls) => (
                <Button key={cls.id} variant={classId === cls.id ? "default" : "outline"} size="sm" onClick={() => { if (dirty && !window.confirm("You have unsaved changes. Continue?")) return; setClassId(cls.id); }}>
                  {classLabel(cls)}
                </Button>
              ))}
            </div>
          )}
        </Panel>

        {selectedClass && <>
          <StatGrid items={[
            ["Students", String(students.length), classLabel(selectedClass)],
            ["Present", String(counts.present + counts.late), `${counts.late} late`],
            ["Absent", String(counts.absent), date],
            ["Unmarked", String(Math.max(0, students.length - Object.keys(marks).length)), "Remaining"],
          ]} />

          <Panel
            title={`Attendance · ${classLabel(selectedClass)}`}
            subtitle="Mark each student's status for the selected date."
            action={
              <div className="flex flex-wrap gap-2">
                <Input type="date" max={todayISO()} value={date} onChange={(e) => { if (dirty && !window.confirm("Unsaved changes. Continue?")) return; setDate(e.target.value); }} className="h-9 w-40" />
                <Button variant="outline" size="sm" disabled={!students.length} onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "present" as AttStatus])))}>
                  <CheckCheck className="mr-2 h-4 w-4" />All present
                </Button>
                <Button size="sm" disabled={saving || loading || !students.length || !dirty} onClick={save}>
                  <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save"}
                </Button>
              </div>
            }
          >
            {loading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No students enrolled in this class.</p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm">
                      <span className="mr-3 inline-block w-8 text-muted-foreground tabular-nums">{s.roll_no}</span>
                      {s.full_name}
                    </span>
                    <div className="flex gap-1">
                      {STATUSES.map((st) => (
                        <button key={st.key} onClick={() => setMarks((cur) => ({ ...cur, [s.id]: st.key }))} aria-label={`${s.full_name}: ${st.key}`}
                          className={cn("h-8 min-w-9 rounded-md border px-2 text-xs font-semibold", marks[s.id] === st.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {dirty && <p className="mt-3 text-xs font-medium text-amber-600">⚠ You have unsaved changes</p>}
          </Panel>

          {/* 7-day history */}
          {history.length > 0 && (
            <Panel title="Past 7 Days" subtitle={`${classLabel(selectedClass)} · Read-only summary`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium text-center">Present</th>
                      <th className="px-3 py-2 font-medium text-center">Absent</th>
                      <th className="px-3 py-2 font-medium text-center">Late</th>
                      <th className="px-3 py-2 font-medium text-center">Leave</th>
                      <th className="px-3 py-2 font-medium text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.att_date} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{h.att_date}</td>
                        <td className="px-3 py-2 text-center font-medium text-green-600">{h.present}</td>
                        <td className="px-3 py-2 text-center font-medium text-red-600">{h.absent}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{h.late}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{h.leave}</td>
                        <td className="px-3 py-2 text-center">{h.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>}
      </div>
    </AppShell>
  );
}
