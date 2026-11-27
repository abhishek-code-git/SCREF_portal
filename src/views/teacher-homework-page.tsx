"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, todayISO } from "@/lib/school-data";

type SubjectRow = { id: string; name: string };
type HomeworkRow = { id: string; class_id: string; subject_id: string | null; title: string; description: string; due_date: string | null; created_by: string; created_at: string };

export function TeacherHomeworkPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setLoading(false); return; }
    setLoading(true);
    const classIds = classes.map((c) => c.id);
    const [hwRes, subRes] = await Promise.all([
      classIds.length ? supabase.from("homework").select("*").eq("school_id", activeSchool.id).in("class_id", classIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from("subjects").select("id,name").eq("school_id", activeSchool.id).order("name"),
    ]);
    if (hwRes.error) toast.error(`Failed to load homework: ${hwRes.error.message}`);
    setHomework((hwRes.data ?? []) as HomeworkRow[]);
    setSubjects((subRes.data ?? []) as SubjectRow[]);
    setLoading(false);
  }, [activeSchool, activeRole, user, classes]);

  useEffect(() => { if (!classesLoading) void load(); }, [load, classesLoading]);

  const resetForm = () => { setFormClassId(""); setFormSubjectId(""); setFormTitle(""); setFormDesc(""); setFormDueDate(""); setEditingId(null); setShowForm(false); };

  const startEdit = (hw: HomeworkRow) => {
    setFormClassId(hw.class_id);
    setFormSubjectId(hw.subject_id ?? "");
    setFormTitle(hw.title);
    setFormDesc(hw.description);
    setFormDueDate(hw.due_date ?? "");
    setEditingId(hw.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSchool || !user) return;
    setSaving(true);
    if (editingId) {
      const { error: err } = await supabase.from("homework").update({ class_id: formClassId, subject_id: formSubjectId || null, title: formTitle.trim(), description: formDesc.trim(), due_date: formDueDate || null, updated_at: new Date().toISOString() }).eq("id", editingId);
      setSaving(false);
      if (err) { toast.error(`Update failed: ${err.message}`); return; }
      toast.success("Homework updated");
    } else {
      const { error: err } = await supabase.from("homework").insert({ school_id: activeSchool.id, class_id: formClassId, subject_id: formSubjectId || null, title: formTitle.trim(), description: formDesc.trim(), due_date: formDueDate || null, created_by: user.id });
      setSaving(false);
      if (err) { toast.error(`Create failed: ${err.message}`); return; }
      toast.success("Homework created");
    }
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this homework?")) return;
    const { error: err } = await supabase.from("homework").delete().eq("id", id);
    if (err) { toast.error(`Delete failed: ${err.message}`); return; }
    toast.success("Homework deleted");
    await load();
  };

  if (!ready) return <AppShell title="Homework"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Homework"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Homework"><Panel title="No school">Ask your principal to assign your account.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Homework"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  // This week's count per class
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartISO = weekStart.toISOString().slice(0, 10);
  const weekCounts: Record<string, number> = {};
  for (const hw of homework) {
    if (hw.created_at.slice(0, 10) >= weekStartISO) {
      weekCounts[hw.class_id] = (weekCounts[hw.class_id] ?? 0) + 1;
    }
  }

  return (
    <AppShell title="Homework" subtitle={`${activeSchool.name} · Manage homework for your classes`}>
      <div className="space-y-6">
        {classesLoading ? <div className="surface-panel h-20 animate-pulse" /> : classes.length === 0 ? (
          <Panel title="No classes assigned"><p className="py-6 text-center text-sm text-muted-foreground">Ask your principal to assign a class.</p></Panel>
        ) : (
          <>
            {/* This week stats */}
            <div className="flex flex-wrap gap-3">
              {classes.map((cls) => (
                <div key={cls.id} className="surface-panel px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">{classLabel(cls)}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{weekCounts[cls.id] ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">this week</p>
                </div>
              ))}
            </div>

            {/* Create / Edit form */}
            {!showForm ? (
              <Button onClick={() => { setShowForm(true); setEditingId(null); }}><Plus className="mr-2 h-4 w-4" />New homework</Button>
            ) : (
              <Panel title={editingId ? "Edit Homework" : "New Homework"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Class</Label>
                      <select required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={formClassId} onChange={(e) => setFormClassId(e.target.value)}>
                        <option value="">Select class</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subject (optional)</Label>
                      <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={formSubjectId} onChange={(e) => setFormSubjectId(e.target.value)}>
                        <option value="">None</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input required maxLength={200} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Homework title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Details and instructions" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due date</Label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Create"}</Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </form>
              </Panel>
            )}

            {/* Homework list */}
            <Panel title="All Homework" subtitle={`${homework.length} total`}>
              {loading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : homework.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No homework created yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {homework.map((hw) => {
                    const cls = classes.find((c) => c.id === hw.class_id);
                    const subj = subjects.find((s) => s.id === hw.subject_id);
                    const isMine = hw.created_by === user.id;
                    return (
                      <li key={hw.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{hw.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {cls ? classLabel(cls) : "Class"}{subj ? ` · ${subj.name}` : ""}{hw.due_date ? ` · Due ${hw.due_date}` : ""}
                          </p>
                          {hw.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{hw.description}</p>}
                        </div>
                        {isMine && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(hw)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => void handleDelete(hw.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
