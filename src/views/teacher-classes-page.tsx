"use client";

import { Users, ChevronRight, Percent } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, todayISO } from "@/lib/school-data";
import { cn } from "@/lib/utils";

type StudentDetail = { id: string; full_name: string; roll_no: number; class_id: string; parent_name: string; parent_phone: string };
type AttendanceSummary = { total: number; present: number };

export function TeacherClassesPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [attMap, setAttMap] = useState<Record<string, AttendanceSummary>>({});
  const [studentsLoading, setStudentsLoading] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !activeSchool) { setStudents([]); return; }
    setStudentsLoading(true);
    const [studRes, attRes] = await Promise.all([
      supabase.from("students").select("id,full_name,roll_no,class_id,parent_name,parent_phone").eq("class_id", selectedClassId).order("roll_no"),
      supabase.from("attendance_records").select("student_id,status").eq("class_id", selectedClassId).gte("att_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    ]);
    setStudents((studRes.data ?? []) as StudentDetail[]);
    // Build 30-day attendance summary per student
    const map: Record<string, AttendanceSummary> = {};
    for (const rec of (attRes.data ?? [])) {
      const sid = rec.student_id as string;
      if (!map[sid]) map[sid] = { total: 0, present: 0 };
      map[sid].total += 1;
      if (rec.status === "present" || rec.status === "late") map[sid].present += 1;
    }
    setAttMap(map);
    setStudentsLoading(false);
  }, [selectedClassId, activeSchool]);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  if (!ready) return <AppShell title="My Classes"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="My Classes"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="My Classes"><Panel title="No school assigned">Ask your principal to assign your account to a school.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="My Classes"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  return (
    <AppShell title="My Classes" subtitle={`${activeSchool.name} · ${classes.length} class(es) assigned`}>
      <div className="space-y-6">
        {classesLoading ? (
          <div className="surface-panel h-32 animate-pulse" />
        ) : classes.length === 0 ? (
          <Panel title="No classes assigned">
            <p className="py-8 text-center text-sm text-muted-foreground">Ask your principal to assign a class to your account.</p>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((cls) => (
              <article key={cls.id} className={cn("rounded-lg border p-4 transition-colors", selectedClassId === cls.id ? "border-primary bg-primary/5" : "border-border")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{classLabel(cls)}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{cls.role} · {cls.student_count} students</p>
                    {cls.subjects.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Subjects: {cls.subjects.join(", ")}</p>}
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium"><Users className="h-4 w-4" /></span>
                </div>
                <Button className="mt-4 w-full" variant={selectedClassId === cls.id ? "default" : "outline"} size="sm" onClick={() => setSelectedClassId(cls.id)}>
                  {selectedClassId === cls.id ? "Selected" : "View students"} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </article>
            ))}
          </div>
        )}

        {selectedClass && (
          <Panel title={`Students · ${classLabel(selectedClass)}`} subtitle={`${students.length} students · 30-day attendance`}>
            {studentsLoading ? <p className="py-6 text-sm text-muted-foreground">Loading students…</p> : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No students enrolled in this class.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Roll</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Parent</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium text-right">Attendance (30d)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const att = attMap[s.id];
                      const pct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.roll_no}</td>
                          <td className="px-3 py-2 font-medium">{s.full_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.parent_name || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.parent_phone || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {pct !== null ? (
                              <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600")}>
                                <Percent className="h-3 w-3" />{pct}%
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
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
