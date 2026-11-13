"use client";

import { CheckCheck, DoorOpen, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, todayISO, type AttStatus, type ClassRow, type StudentRow } from "@/lib/school-data";
import { cn } from "@/lib/utils";

const STATUSES: { key: AttStatus; label: string }[] = [
  { key: "present", label: "P" }, { key: "absent", label: "A" }, { key: "late", label: "L" }, { key: "leave", label: "Lv" },
];

export function TeacherPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setClasses([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase.from("classes").select("id,name,section,class_teacher").eq("school_id", activeSchool.id).eq("class_teacher", user.id).order("name").order("section");
    if (loadError) { toast.error(`Unable to load assigned classes: ${loadError.message}`); setClasses([]); }
    else setClasses((data ?? []) as ClassRow[]);
    setLoading(false);
  }, [activeSchool, activeRole, user]);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  const selectedClass = classes.find((item) => item.id === classId);
  const loadClassRecords = useCallback(async () => {
    if (!selectedClass) { setStudents([]); setMarks({}); return; }
    setLoading(true);
    const [studentResult, attendanceResult] = await Promise.all([
      supabase.from("students").select("id,full_name,roll_no,class_id").eq("class_id", selectedClass.id).order("roll_no"),
      supabase.from("attendance_records").select("student_id,status").eq("class_id", selectedClass.id).eq("att_date", date),
    ]);
    if (studentResult.error || attendanceResult.error) toast.error(`Unable to load class records: ${(studentResult.error ?? attendanceResult.error)?.message}`);
    setStudents((studentResult.data ?? []) as StudentRow[]);
    setMarks(Object.fromEntries((attendanceResult.data ?? []).map((r) => [r.student_id, r.status as AttStatus])));
    setLoading(false);
  }, [date, selectedClass]);

  useEffect(() => { void loadClassRecords(); }, [loadClassRecords]);

  const counts = useMemo(() => {
    const tally = { present: 0, absent: 0, late: 0, leave: 0 };
    Object.values(marks).forEach((status) => { tally[status] += 1; });
    return tally;
  }, [marks]);

  if (!ready) return <AppShell title="Teacher's Desk"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Teacher's Desk"><Panel title="School access unavailable">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Teacher's Desk"><Panel title="No school assigned">Ask your principal to assign your account to a school.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Teacher's Desk"><Panel title="Choose your teacher workspace">Select an active teacher membership to view assigned classes.</Panel></AppShell>;

  const save = async () => {
    if (!selectedClass || !user || !students.length) return;
    const rows = students.filter((student) => marks[student.id]).map((student) => ({ school_id: activeSchool.id, class_id: selectedClass.id, student_id: student.id, att_date: date, status: marks[student.id]!, marked_by: user.id }));
    if (!rows.length) { toast.error("Mark at least one student first"); return; }
    setSaving(true);
    const { error: saveError } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,att_date" });
    setSaving(false);
    if (saveError) { toast.error(`Attendance could not be saved: ${saveError.message}`); return; }
    toast.success(`Attendance saved for ${rows.length} students`);
  };

  return <AppShell title="Teacher's Desk" subtitle={`${activeSchool.name} · Assigned classes`}>
    <div className="space-y-6">
      <Panel title="My assigned classes" subtitle="Only classes assigned to your teacher account appear here.">
        {loading && !classes.length ? <p className="py-6 text-sm text-muted-foreground">Loading your assignments…</p> : classes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No classes are assigned to your account. Ask your principal to assign a class.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{classes.map((cls) => <article key={cls.id} className={cn("rounded-lg border p-4", classId === cls.id ? "border-primary bg-primary/5" : "border-border")}><p className="font-semibold">{classLabel(cls)}</p><p className="mt-1 text-xs text-muted-foreground">{activeSchool.name} · Class teacher assignment</p><Button className="mt-4 w-full" variant={classId === cls.id ? "default" : "outline"} onClick={() => setClassId(cls.id)}><DoorOpen className="mr-2 h-4 w-4" />{classId === cls.id ? "Selected" : "Enter class"}</Button></article>)}</div>}
      </Panel>

      {selectedClass && <>
        <StatGrid items={[["Students", String(students.length), classLabel(selectedClass)], ["Present", String(counts.present + counts.late), `${counts.late} late`], ["Absent", String(counts.absent), date], ["Unmarked", String(Math.max(0, students.length - Object.keys(marks).length)), "Selected class"]]} />
        <Panel title={`Attendance · ${classLabel(selectedClass)}`} subtitle="View assigned class students and record attendance." action={<div className="flex flex-wrap gap-2"><Input type="date" max={todayISO()} value={date} onChange={(event) => setDate(event.target.value)} className="h-9 w-40" /><Button variant="outline" size="sm" disabled={!students.length} onClick={() => setMarks(Object.fromEntries(students.map((student) => [student.id, "present" as AttStatus])))}><CheckCheck className="mr-2 h-4 w-4" />All present</Button><Button size="sm" disabled={saving || loading || !students.length} onClick={save}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save"}</Button></div>}>
          {loading ? <p className="py-6 text-sm text-muted-foreground">Loading class records…</p> : students.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No students are enrolled in this class.</p> : <ul className="divide-y divide-border">{students.map((student) => <li key={student.id} className="flex items-center justify-between gap-3 py-2.5"><span className="text-sm"><span className="mr-3 inline-block w-8 text-muted-foreground tabular-nums">{student.roll_no}</span>{student.full_name}</span><div className="flex gap-1">{STATUSES.map((status) => <button key={status.key} onClick={() => setMarks((current) => ({ ...current, [student.id]: status.key }))} aria-label={`${student.full_name}: ${status.key}`} className={cn("h-8 min-w-9 rounded-md border px-2 text-xs font-semibold", marks[student.id] === status.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>{status.label}</button>)}</div></li>)}</ul>}
        </Panel>
      </>}
      <p className="text-xs text-muted-foreground">Timetable, subjects, homework, lesson plans, assessments and announcements do not have live tables in this project yet.</p>
    </div>
  </AppShell>;
}
