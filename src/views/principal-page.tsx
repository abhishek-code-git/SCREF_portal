"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type SchoolClass = { id: string; name: string; section: string; class_teacher: string | null };
type Student = { id: string; full_name: string; roll_no: number; class_id: string; status: string };
type Staff = { user_id: string; full_name: string; role: string };
type Task = { id: string; title: string; done: boolean; due_date: string | null };

function PrincipalTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("principal_tasks").select("id,title,done,due_date").order("done").order("created_at", { ascending: false });
    if (error) toast.error(`Unable to load your tasks: ${error.message}`);
    else setTasks(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { error } = await supabase.from("principal_tasks").insert({ title: title.trim(), due_date: dueDate || null });
    if (error) { toast.error(`Unable to add task: ${error.message}`); return; }
    setTitle(""); setDueDate(""); await load();
  };
  const toggle = async (task: Task) => {
    const { error } = await supabase.from("principal_tasks").update({ done: !task.done }).eq("id", task.id);
    if (error) toast.error(`Unable to update task: ${error.message}`); else await load();
  };
  const remove = async (task: Task) => {
    const { error } = await supabase.from("principal_tasks").delete().eq("id", task.id);
    if (error) toast.error(`Unable to delete task: ${error.message}`); else await load();
  };
  return <Panel title="My tasks" subtitle="Private tasks saved to your account"><form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input required maxLength={180} placeholder="Add a school task" value={title} onChange={(event) => setTitle(event.target.value)} /><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><Button>Add task</Button></form>{tasks.length ? <ul className="divide-y divide-border">{tasks.map((task) => <li key={task.id} className="flex items-center gap-3 py-2"><button className="flex-1 text-left text-sm" onClick={() => void toggle(task)}><span className={task.done ? "line-through text-muted-foreground" : ""}>{task.title}</span>{task.due_date && <span className="ml-2 text-xs text-muted-foreground">Due {task.due_date}</span>}</button><Button size="icon" variant="ghost" aria-label="Delete task" onClick={() => void remove(task)}><Trash2 className="h-4 w-4" /></Button></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">No tasks yet.</p>}</Panel>;
}

export function PrincipalPage() {
  const { activeSchool, activeRole, ready, error: accessError } = useSchoolContext();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("A");
  const [saving, setSaving] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("1");
  const [studentClass, setStudentClass] = useState("");

  const load = useCallback(async () => {
    if (!activeSchool) { setLoading(false); return; }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [classResult, studentResult, staffResult, attendanceResult] = await Promise.all([
      supabase.from("classes").select("id,name,section,class_teacher").eq("school_id", activeSchool.id).order("name").order("section"),
      supabase.from("students").select("id,full_name,roll_no,class_id,status").eq("school_id", activeSchool.id).order("full_name"),
      supabase.from("memberships").select("user_id,role").eq("school_id", activeSchool.id).in("role", ["teacher", "school_principal", "admissions_staff"]),
      supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", activeSchool.id).eq("att_date", today),
    ]);
    const failed = [classResult.error, studentResult.error, staffResult.error, attendanceResult.error].find(Boolean);
    if (failed) toast.error(`Unable to load school records: ${failed.message}`);
    setClasses(classResult.data ?? []);
    setStudents(studentResult.data ?? []);
    setAttendanceToday(attendanceResult.count ?? 0);
    const memberships = staffResult.data ?? [];
    if (memberships.length) {
      const profiles = await supabase.from("profiles").select("user_id,full_name").in("user_id", memberships.map((m) => m.user_id));
      if (profiles.error) toast.error(`Unable to load staff profiles: ${profiles.error.message}`);
      const names = new Map((profiles.data ?? []).map((p) => [p.user_id, p.full_name]));
      setStaff(memberships.map((m) => ({ user_id: m.user_id, role: m.role, full_name: names.get(m.user_id) || "Profile name unavailable" })));
    } else setStaff([]);
    setLoading(false);
  }, [activeSchool]);

  useEffect(() => { void load(); }, [load]);

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSchool || activeRole !== "school_principal") return;
    setSaving(true);
    const { error } = await supabase.from("classes").insert({ school_id: activeSchool.id, name: className.trim(), section: section.trim().toUpperCase() });
    setSaving(false);
    if (error) { toast.error(`Unable to create class: ${error.message}`); return; }
    setClassName(""); setSection("A"); toast.success("Class created"); await load();
  };

  const assignTeacher = async (classId: string, teacherId: string) => {
    if (!activeSchool || activeRole !== "school_principal") return;
    const { error } = await supabase.from("classes").update({ class_teacher: teacherId || null }).eq("id", classId).eq("school_id", activeSchool.id);
    if (error) { toast.error(`Unable to update teacher assignment: ${error.message}`); return; }
    toast.success("Teacher assignment updated");
    await load();
  };

  const enrollStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSchool || activeRole !== "school_principal" || !studentClass) return;
    const { error } = await supabase.from("students").insert({ school_id: activeSchool.id, class_id: studentClass, full_name: studentName.trim(), roll_no: Number(studentRoll) });
    if (error) { toast.error(`Unable to enroll student: ${error.message}`); return; }
    setStudentName(""); setStudentRoll("1"); toast.success("Student enrolled"); await load();
  };

  if (!ready) return <AppShell title="Principal's Desk"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Principal's Desk"><Panel title="School access unavailable">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Principal's Desk"><Panel title="No school assigned">Ask your administrator to assign your principal membership to a school.</Panel></AppShell>;

  return (
    <AppShell title="Principal's Desk" subtitle={`${activeSchool.name} · School overview`}>
      <div className="space-y-6">
        <StatGrid items={[
          ["Classes & sections", loading ? "…" : String(classes.length), "From this school"],
          ["Students", loading ? "…" : String(students.length), "Current directory"],
          ["Teachers", loading ? "…" : String(staff.filter((s) => s.role === "teacher").length), "School memberships"],
          ["Attendance marked today", loading ? "…" : String(attendanceToday), "Records for today"],
        ]} />

        <Panel title="Classes and sections" subtitle="Class records are limited by this school’s database access policies." action={<span className="text-xs text-muted-foreground">{classes.length} total</span>}>
          {activeRole === "school_principal" && <form onSubmit={createClass} className="mb-5 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <Input required maxLength={80} placeholder="Class or grade name" value={className} onChange={(e) => setClassName(e.target.value)} />
            <Input required maxLength={20} aria-label="Section" placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
            <Button disabled={saving}>{saving ? "Creating…" : "Add class"}</Button>
          </form>}
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading classes…</p> : classes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No classes are configured for this school yet.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{classes.map((c) => {
            const classStudents = students.filter((s) => s.class_id === c.id);
            const teacher = staff.find((p) => p.user_id === c.class_teacher);
            return <article key={c.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{c.name} · Section {c.section}</h3><p className="mt-1 text-xs text-muted-foreground">{teacher ? teacher.full_name : "Teacher not assigned"}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-xs">{classStudents.length} students</span></div>{activeRole === "school_principal" && <label className="mt-3 block text-xs text-muted-foreground">Class teacher<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={c.class_teacher ?? ""} onChange={(event) => void assignTeacher(c.id, event.target.value)}><option value="">Unassigned</option>{staff.filter((p) => p.role === "teacher").map((person) => <option key={person.user_id} value={person.user_id}>{person.full_name}</option>)}</select></label>}<ul className="mt-3 space-y-1 text-xs text-muted-foreground">{classStudents.slice(0, 4).map((student) => <li key={student.id}>{student.roll_no}. {student.full_name}</li>)}</ul>{classStudents.length > 4 && <p className="mt-1 text-xs text-muted-foreground">and {classStudents.length - 4} more students</p>}</article>;
          })}</div>}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Teacher and staff directory" subtitle="Active school memberships with profile names when available">
            {loading ? <p className="py-5 text-sm text-muted-foreground">Loading directory…</p> : staff.length ? <ul className="divide-y divide-border">{staff.map((person) => <li key={person.user_id} className="flex justify-between gap-3 py-3"><span className="text-sm">{person.full_name}</span><span className="text-xs text-muted-foreground">{person.role.replaceAll("_", " ")}{classes.some((c) => c.class_teacher === person.user_id) ? ` · ${classes.filter((c) => c.class_teacher === person.user_id).map((c) => `${c.name}-${c.section}`).join(", ")}` : ""}</span></li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">No teacher or staff memberships found for this school.</p>}
          </Panel>
          <Panel title="Student directory" subtitle="Students grouped by their current class">
            {activeRole === "school_principal" && <form onSubmit={enrollStudent} className="mb-4 grid gap-2 sm:grid-cols-[1fr_100px_150px_auto]"><Input required maxLength={120} placeholder="Student full name" value={studentName} onChange={(event) => setStudentName(event.target.value)} /><Input required type="number" min="1" value={studentRoll} onChange={(event) => setStudentRoll(event.target.value)} aria-label="Roll number" /><select required className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={studentClass} onChange={(event) => setStudentClass(event.target.value)} aria-label="Enroll in class"><option value="">Select class</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} · {cls.section}</option>)}</select><Button disabled={!classes.length}>Enroll</Button></form>}
            {loading ? <p className="py-5 text-sm text-muted-foreground">Loading students…</p> : students.length ? <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">{students.map((student) => <li key={student.id} className="flex justify-between gap-3 py-3"><span className="text-sm">{student.full_name}<span className="ml-2 text-xs text-muted-foreground">#{student.roll_no}</span></span><span className="text-xs text-muted-foreground">{classes.find((c) => c.id === student.class_id)?.name ?? "Class unavailable"} · {classes.find((c) => c.id === student.class_id)?.section ?? ""}</span></li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">No students enrolled yet.</p>}
          </Panel>
        </div>
        <PrincipalTasks />
        <p className="text-xs text-muted-foreground">Timetable, subjects, admissions, examinations, homework, announcements, finance and reports are not connected to live school tables in this project yet.</p>
      </div>
    </AppShell>
  );
}
