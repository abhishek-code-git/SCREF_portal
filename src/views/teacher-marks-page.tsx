"use client";

import { Save, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, type StudentRow } from "@/lib/school-data";
import { cn } from "@/lib/utils";

type ExamRow = { id: string; name: string; status: string; exam_date: string | null };
type SubjectRow = { id: string; name: string };
type MarkRow = { id: string; student_id: string; marks_obtained: number; max_marks: number };

export function TeacherMarksPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  // Grid state
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [markEntries, setMarkEntries] = useState<Record<string, { marks: string; max: string }>>({});
  const [existingMarks, setExistingMarks] = useState<MarkRow[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedExam = exams.find((e) => e.id === examId);
  const isEditable = selectedExam?.status === "marks_open";
  const isPublished = selectedExam?.status === "published";

  const load = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setLoading(false); return; }
    setLoading(true);
    const [examRes, subRes] = await Promise.all([
      supabase.from("exams").select("id,name,status,exam_date").eq("school_id", activeSchool.id).order("created_at", { ascending: false }),
      supabase.from("subjects").select("id,name").eq("school_id", activeSchool.id).order("name"),
    ]);
    setExams((examRes.data ?? []) as ExamRow[]);
    setSubjects((subRes.data ?? []) as SubjectRow[]);
    setLoading(false);
  }, [activeSchool, activeRole, user]);

  useEffect(() => { void load(); }, [load]);

  const loadGrid = useCallback(async () => {
    if (!examId || !classId || !subjectId || !activeSchool) { setStudents([]); setMarkEntries({}); setExistingMarks([]); return; }
    setGridLoading(true);
    const [studRes, marksRes] = await Promise.all([
      supabase.from("students").select("id,full_name,roll_no,class_id").eq("class_id", classId).order("roll_no"),
      supabase.from("exam_marks").select("id,student_id,marks_obtained,max_marks").eq("exam_id", examId).eq("class_id", classId).eq("subject_id", subjectId),
    ]);
    const studs = (studRes.data ?? []) as StudentRow[];
    const marks = (marksRes.data ?? []) as MarkRow[];
    setStudents(studs);
    setExistingMarks(marks);
    const entries: Record<string, { marks: string; max: string }> = {};
    for (const s of studs) {
      const existing = marks.find((m) => m.student_id === s.id);
      entries[s.id] = existing
        ? { marks: String(existing.marks_obtained), max: String(existing.max_marks) }
        : { marks: "", max: "100" };
    }
    setMarkEntries(entries);
    setGridLoading(false);
  }, [examId, classId, subjectId, activeSchool]);

  useEffect(() => { void loadGrid(); }, [loadGrid]);

  const enteredCount = useMemo(() => Object.values(markEntries).filter((e) => e.marks !== "").length, [markEntries]);
  const totalCount = students.length;

  const stats = useMemo(() => {
    const filled = Object.entries(markEntries).filter(([, e]) => e.marks !== "");
    if (filled.length === 0) return null;
    const vals = filled.map(([, e]) => Number(e.marks));
    const maxVals = filled.map(([, e]) => Number(e.max) || 100);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const highest = Math.max(...vals);
    const lowest = Math.min(...vals);
    const passCount = filled.filter(([, e]) => {
      const pct = (Number(e.marks) / (Number(e.max) || 100)) * 100;
      return pct >= 33;
    }).length;
    return { avg: avg.toFixed(1), highest, lowest, passPct: ((passCount / filled.length) * 100).toFixed(0) };
  }, [markEntries]);

  const saveAll = async () => {
    if (!activeSchool || !user || !examId || !classId || !subjectId) return;
    const rows = students
      .filter((s) => markEntries[s.id]?.marks !== "")
      .map((s) => {
        const entry = markEntries[s.id]!;
        const obtained = Number(entry.marks);
        const max = Number(entry.max) || 100;
        if (isNaN(obtained) || obtained < 0 || obtained > max) return null;
        return {
          school_id: activeSchool.id, exam_id: examId, class_id: classId, subject_id: subjectId,
          student_id: s.id, marks_obtained: obtained, max_marks: max, entered_by: user.id,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);
    if (rows.length === 0) { toast.error("Enter at least one valid mark"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("exam_marks").upsert(rows as NonNullable<(typeof rows)[number]>[], { onConflict: "exam_id,student_id,subject_id" });
    setSaving(false);
    if (err) { toast.error(`Save failed: ${err.message}`); return; }
    toast.success(`Saved marks for ${rows.length} students`);
    await loadGrid();
  };

  if (!ready) return <AppShell title="Marks"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Marks"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Marks"><Panel title="No school">Ask your principal to assign your account.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Marks"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  return (
    <AppShell title="Marks" subtitle={`${activeSchool.name} · Enter exam marks`}>
      <div className="space-y-6">
        {/* Selection */}
        <Panel title="Select exam, class and subject">
          {loading || classesLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : classes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No classes assigned.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Exam</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  <option value="">Select exam</option>
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name} ({ex.status.replace("_", " ")})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Class</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </Panel>

        {examId && classId && subjectId && selectedExam && (
          <>
            {isPublished && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium dark:border-amber-700 dark:bg-amber-900/20">
                <Lock className="h-4 w-4" /> This exam is published. Marks are read-only.
              </div>
            )}

            {!isEditable && !isPublished && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                This exam is in draft status. Marks entry will be available when status is set to &quot;marks open&quot;.
              </div>
            )}

            {/* Progress */}
            <StatGrid items={[
              ["Entered", `${enteredCount} of ${totalCount}`, "students"],
              ["Average", stats?.avg ?? "—", "marks"],
              ["Highest", stats ? String(stats.highest) : "—", "marks"],
              ["Pass %", stats ? `${stats.passPct}%` : "—", "≥ 33%"],
            ]} />

            {/* Marks grid */}
            <Panel
              title={`Marks · ${selectedExam.name}`}
              subtitle={`${classLabel(classes.find((c) => c.id === classId)!)} · ${subjects.find((s) => s.id === subjectId)?.name ?? "Subject"}`}
              action={isEditable ? (
                <Button size="sm" disabled={saving || gridLoading || !students.length} onClick={saveAll}>
                  <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save all"}
                </Button>
              ) : undefined}
            >
              {gridLoading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : students.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No students in this class.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Roll</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Marks</th>
                        <th className="px-3 py-2 font-medium">Max</th>
                        <th className="px-3 py-2 font-medium text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const entry = markEntries[s.id] ?? { marks: "", max: "100" };
                        const pct = entry.marks !== "" && Number(entry.max) > 0
                          ? ((Number(entry.marks) / Number(entry.max)) * 100).toFixed(0)
                          : null;
                        const invalid = entry.marks !== "" && (isNaN(Number(entry.marks)) || Number(entry.marks) < 0 || Number(entry.marks) > Number(entry.max));
                        return (
                          <tr key={s.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.roll_no}</td>
                            <td className="px-3 py-2 font-medium">{s.full_name}</td>
                            <td className="px-3 py-2">
                              {isEditable ? (
                                <Input
                                  type="number" min="0" max={Number(entry.max)} step="0.5"
                                  value={entry.marks}
                                  onChange={(e) => setMarkEntries((prev) => ({ ...prev, [s.id]: { ...prev[s.id]!, marks: e.target.value } }))}
                                  className={cn("h-8 w-20", invalid && "border-red-500")}
                                />
                              ) : (
                                <span className="tabular-nums">{entry.marks || "—"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditable ? (
                                <Input
                                  type="number" min="1" step="1"
                                  value={entry.max}
                                  onChange={(e) => setMarkEntries((prev) => ({ ...prev, [s.id]: { ...prev[s.id]!, max: e.target.value } }))}
                                  className="h-8 w-20"
                                />
                              ) : (
                                <span className="tabular-nums text-muted-foreground">{entry.max || "—"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {pct !== null ? (
                                <span className={cn("text-xs font-semibold tabular-nums", Number(pct) >= 75 ? "text-green-600" : Number(pct) >= 33 ? "text-amber-600" : "text-red-600")}>{pct}%</span>
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
          </>
        )}
      </div>
    </AppShell>
  );
}
