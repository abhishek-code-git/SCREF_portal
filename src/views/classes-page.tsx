"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calendar, Plus, Trash2, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ClassRow = { id: string; name: string; section: string; class_teacher: string | null };
type SubjectRow = { id: string; name: string; code: string };
type TeacherRow = { user_id: string; full_name: string };
type AssignmentRow = { id: string; class_id: string; teacher_user_id: string; subject_name: string; is_active: boolean };
type SlotRow = {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_user_id: string;
  day_of_week: number;
  period: number;
  start_time: string;
  end_time: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function ClassesPage() {
  const { activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"classes" | "subjects" | "timetable">("classes");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("A");
  const [subName, setSubName] = useState("");
  const [subCode, setSubCode] = useState("");

  // Subject teacher assignment
  const [assignClassId, setAssignClassId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignSubject, setAssignSubject] = useState("");

  // Timetable slot form
  const [ttClassId, setTtClassId] = useState("");
  const [ttDay, setTtDay] = useState("0");
  const [ttPeriod, setTtPeriod] = useState("1");
  const [ttSubjectId, setTtSubjectId] = useState("");
  const [ttTeacherId, setTtTeacherId] = useState("");
  const [ttStart, setTtStart] = useState("08:30");
  const [ttEnd, setTtEnd] = useState("09:15");

  const [confirmDeleteClass, setConfirmDeleteClass] = useState<ClassRow | null>(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<SubjectRow | null>(null);

  const dataQuery = useQuery({
    queryKey: ["school-classes-mgmt", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No active school");
      const [clsRes, subRes, staffRes, assignRes, slotRes, studCountRes] = await Promise.all([
        supabase.from("classes").select("id,name,section,class_teacher").eq("school_id", activeSchool.id).order("name").order("section"),
        supabase.from("subjects").select("id,name,code").eq("school_id", activeSchool.id).order("name"),
        supabase.rpc("school_staff_directory", { _school_id: activeSchool.id }),
        supabase.from("class_teacher_assignments").select("id,class_id,teacher_user_id,subject_name,is_active").eq("school_id", activeSchool.id).eq("is_active", true),
        supabase.from("timetable_slots").select("id,class_id,subject_id,teacher_user_id,day_of_week,period,start_time,end_time").eq("school_id", activeSchool.id).order("period"),
        supabase.rpc("enrolment_report", { _school_id: activeSchool.id }),
      ]);
      const err = clsRes.error ?? subRes.error ?? staffRes.error ?? assignRes.error ?? slotRes.error ?? studCountRes.error;
      if (err) throw err;
      const teachers = ((staffRes.data ?? []) as Array<{ user_id: string; role: string; full_name: string }>)
        .filter((s) => s.role === "teacher")
        .map((s) => ({ user_id: s.user_id, full_name: s.full_name }));
      const counts = new Map(
        ((studCountRes.data ?? []) as Array<{ class_id: string; total_count: number }>).map((r) => [r.class_id, r.total_count]),
      );
      return {
        classes: (clsRes.data ?? []) as ClassRow[],
        subjects: (subRes.data ?? []) as SubjectRow[],
        teachers,
        assignments: (assignRes.data ?? []) as AssignmentRow[],
        slots: (slotRes.data ?? []) as SlotRow[],
        counts,
      };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school-classes-mgmt", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
  };

  const createClassMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const { error } = await supabase.from("classes").insert({
        school_id: activeSchool.id,
        name: className.trim(),
        section: section.trim().toUpperCase() || "A",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setClassName("");
      setSection("A");
      toast.success("Class created");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignClassTeacherMut = useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string }) => {
      if (!activeSchool) return;
      const { error } = await supabase
        .from("classes")
        .update({ class_teacher: teacherId || null })
        .eq("id", classId)
        .eq("school_id", activeSchool.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Class teacher updated");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteClassMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDeleteClass(null);
      toast.success("Class removed");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addSubjectTeacherMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const { error } = await supabase.from("class_teacher_assignments").upsert(
        {
          school_id: activeSchool.id,
          class_id: assignClassId,
          teacher_user_id: assignTeacherId,
          subject_name: assignSubject.trim(),
          is_active: true,
        },
        { onConflict: "class_id,teacher_user_id,subject_name" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      setAssignSubject("");
      toast.success("Subject teacher assigned");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAssignmentMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_teacher_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Assignment removed");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSubjectMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const { error } = await supabase.from("subjects").insert({
        school_id: activeSchool.id,
        name: subName.trim(),
        code: subCode.trim().toUpperCase(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSubName("");
      setSubCode("");
      toast.success("Subject added");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSubjectMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDeleteSubject(null);
      toast.success("Subject deleted");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSlotMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool || !ttClassId || !ttTeacherId) return;
      const { error } = await supabase.from("timetable_slots").upsert(
        {
          school_id: activeSchool.id,
          class_id: ttClassId,
          day_of_week: Number(ttDay),
          period: Number(ttPeriod),
          subject_id: ttSubjectId || null,
          teacher_user_id: ttTeacherId,
          start_time: ttStart,
          end_time: ttEnd,
        },
        { onConflict: "school_id,class_id,day_of_week,period" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Timetable slot saved");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSlotMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Timetable slot removed");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Classes & Timetable"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Classes & Timetable"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Classes & Timetable"><Panel title="No school assigned">Select or assign a school first.</Panel></AppShell>;

  const classes = dataQuery.data?.classes ?? [];
  const subjects = dataQuery.data?.subjects ?? [];
  const teachers: TeacherRow[] = dataQuery.data?.teachers ?? [];
  const assignments = dataQuery.data?.assignments ?? [];
  const slots = dataQuery.data?.slots ?? [];
  const counts = dataQuery.data?.counts ?? new Map<string, number>();

  const selectedTtClass = ttClassId || classes[0]?.id || "";
  const classSlots = slots.filter((s) => s.class_id === selectedTtClass);
  const teacherMap = new Map(teachers.map((t) => [t.user_id, t.full_name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <AppShell title="Classes & Timetable" subtitle={`${activeSchool.name} · Academic structure`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Classes & Timetable" }]} />

        <div className="flex flex-wrap gap-2">
          {[
            { id: "classes" as const, label: "Classes & Teachers", icon: Users },
            { id: "subjects" as const, label: "Subjects", icon: BookOpen },
            { id: "timetable" as const, label: "Timetable", icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={tab === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(item.id)}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>

        {dataQuery.error && (
          <div role="alert" className="surface-panel p-4 text-sm text-destructive">
            {dataQuery.error.message}
          </div>
        )}

        {tab === "classes" && (
          <>
            <Panel title="Classes & sections" subtitle="Create classes and assign class teachers">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (isWritable && className.trim()) createClassMut.mutate();
                }}
                className="mb-5 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
              >
                <Input
                  required
                  maxLength={80}
                  placeholder="Class name (e.g. Class 5)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={!isWritable || createClassMut.isPending}
                />
                <Input
                  required
                  maxLength={20}
                  aria-label="Section"
                  placeholder="Section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  disabled={!isWritable || createClassMut.isPending}
                />
                <Button type="submit" disabled={!isWritable || createClassMut.isPending || !className.trim()}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {createClassMut.isPending ? "Creating…" : "Add class"}
                </Button>
              </form>

              {dataQuery.isPending ? (
                <p className="py-6 text-sm text-muted-foreground">Loading classes…</p>
              ) : classes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No classes created yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {classes.map((c) => {
                    const classAssigns = assignments.filter(
                      (a) => a.class_id === c.id && a.subject_name !== "Class teacher",
                    );
                    return (
                      <article key={c.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">
                              {c.name} · {c.section}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {counts.get(c.id) ?? 0} active students
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete class ${c.name} ${c.section}`}
                            disabled={!isWritable}
                            onClick={() => setConfirmDeleteClass(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <label className="mt-3 block text-xs text-muted-foreground">
                          Class teacher
                          <select
                            disabled={!isWritable || assignClassTeacherMut.isPending}
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-60"
                            value={c.class_teacher ?? ""}
                            onChange={(e) =>
                              assignClassTeacherMut.mutate({ classId: c.id, teacherId: e.target.value })
                            }
                          >
                            <option value="">Unassigned</option>
                            {teachers.map((t) => (
                              <option key={t.user_id} value={t.user_id}>
                                {t.full_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {classAssigns.length > 0 && (
                          <div className="mt-3 space-y-1 border-t border-border pt-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Subject teachers</p>
                            {classAssigns.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-xs">
                                <span className="truncate">
                                  {a.subject_name}: {teacherMap.get(a.teacher_user_id) ?? "Teacher"}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${a.subject_name} teacher`}
                                  disabled={!isWritable}
                                  onClick={() => removeAssignmentMut.mutate(a.id)}
                                  className="text-destructive hover:underline disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Assign subject teacher" subtitle="Give subject teachers access to specific classes">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (isWritable && assignClassId && assignTeacherId && assignSubject.trim()) {
                    addSubjectTeacherMut.mutate();
                  }
                }}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <select
                  required
                  aria-label="Class"
                  disabled={!isWritable}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignClassId}
                  onChange={(e) => setAssignClassId(e.target.value)}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))}
                </select>
                <select
                  required
                  aria-label="Teacher"
                  disabled={!isWritable}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(e.target.value)}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <Input
                  required
                  list="subject-suggestions"
                  placeholder="Subject name"
                  value={assignSubject}
                  onChange={(e) => setAssignSubject(e.target.value)}
                  disabled={!isWritable}
                />
                <datalist id="subject-suggestions">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                <Button type="submit" disabled={!isWritable || addSubjectTeacherMut.isPending}>
                  {addSubjectTeacherMut.isPending ? "Saving…" : "Assign"}
                </Button>
              </form>
            </Panel>
          </>
        )}

        {tab === "subjects" && (
          <Panel title="Subjects" subtitle="Subjects taught across this school">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (isWritable && subName.trim()) createSubjectMut.mutate();
              }}
              className="mb-5 grid gap-2 sm:grid-cols-[1fr_160px_auto]"
            >
              <Input
                required
                maxLength={80}
                placeholder="Subject name (e.g. Mathematics)"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                disabled={!isWritable || createSubjectMut.isPending}
              />
              <Input
                maxLength={20}
                placeholder="Code (optional)"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                disabled={!isWritable || createSubjectMut.isPending}
              />
              <Button type="submit" disabled={!isWritable || createSubjectMut.isPending || !subName.trim()}>
                <Plus className="mr-1.5 h-4 w-4" />
                {createSubjectMut.isPending ? "Adding…" : "Add subject"}
              </Button>
            </form>

            {subjects.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No subjects added yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.code && <p className="text-xs text-muted-foreground">{s.code}</p>}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete subject ${s.name}`}
                      disabled={!isWritable}
                      onClick={() => setConfirmDeleteSubject(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "timetable" && (
          <div className="space-y-6">
            <Panel title="Add / update timetable slot" subtitle="Assign periods per class (Monday to Saturday)">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (isWritable && selectedTtClass && ttTeacherId) saveSlotMut.mutate();
                }}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-1">
                  <Label>Class</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedTtClass}
                    onChange={(e) => setTtClassId(e.target.value)}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}-{c.section}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Day</Label>
                  <select
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value)}
                  >
                    {DAYS.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Period</Label>
                  <select
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ttPeriod}
                    onChange={(e) => setTtPeriod(e.target.value)}
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Subject</Label>
                  <select
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ttSubjectId}
                    onChange={(e) => setTtSubjectId(e.target.value)}
                  >
                    <option value="">General / Unspecified</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Teacher</Label>
                  <select
                    required
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={ttTeacherId}
                    onChange={(e) => setTtTeacherId(e.target.value)}
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={ttStart}
                    onChange={(e) => setTtStart(e.target.value)}
                    disabled={!isWritable}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>End time</Label>
                  <Input
                    type="time"
                    value={ttEnd}
                    onChange={(e) => setTtEnd(e.target.value)}
                    disabled={!isWritable}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!isWritable || !selectedTtClass || !ttTeacherId || saveSlotMut.isPending}
                  >
                    {saveSlotMut.isPending ? "Saving…" : "Save period"}
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel
              title="Weekly timetable"
              subtitle={
                classes.find((c) => c.id === selectedTtClass)
                  ? `${classes.find((c) => c.id === selectedTtClass)!.name}-${classes.find((c) => c.id === selectedTtClass)!.section}`
                  : "Select a class"
              }
            >
              {classes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Create a class first.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface text-left text-muted-foreground">
                        <th className="p-2.5 font-medium">Period</th>
                        {DAYS.map((d) => (
                          <th key={d} className="p-2.5 font-medium">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map((p) => (
                        <tr key={p} className="border-b border-border">
                          <td className="p-2.5 font-semibold">P{p}</td>
                          {DAYS.map((d, dow) => {
                            const slot = classSlots.find((s) => s.day_of_week === dow && s.period === p);
                            return (
                              <td key={d} className={cn("p-2 align-top", !slot && "text-muted-foreground/40")}>
                                {slot ? (
                                  <div className="rounded border border-border bg-card p-2">
                                    <p className="font-medium text-foreground">
                                      {slot.subject_id ? subjectMap.get(slot.subject_id) ?? "Subject" : "General"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {teacherMap.get(slot.teacher_user_id) ?? "Teacher"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                                    </p>
                                    {isWritable && (
                                      <button
                                        type="button"
                                        onClick={() => deleteSlotMut.mutate(slot.id)}
                                        className="mt-1 text-[10px] text-destructive hover:underline"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteClass}
        onOpenChange={(open) => { if (!open) setConfirmDeleteClass(null); }}
        title="Delete class"
        description={`Delete ${confirmDeleteClass?.name ?? ""} ${confirmDeleteClass?.section ?? ""}? Students, attendance, and timetable slots in this class will also be deleted.`}
        confirmLabel="Delete class"
        destructive
        busy={deleteClassMut.isPending}
        onConfirm={() => { if (confirmDeleteClass) deleteClassMut.mutate(confirmDeleteClass.id); }}
      />
      <ConfirmDialog
        open={!!confirmDeleteSubject}
        onOpenChange={(open) => { if (!open) setConfirmDeleteSubject(null); }}
        title="Delete subject"
        description={`Delete subject "${confirmDeleteSubject?.name ?? ""}"?`}
        confirmLabel="Delete subject"
        destructive
        busy={deleteSubjectMut.isPending}
        onConfirm={() => { if (confirmDeleteSubject) deleteSubjectMut.mutate(confirmDeleteSubject.id); }}
      />
    </AppShell>
  );
}
