"use client";

import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel } from "@/lib/school-data";

type NoticeRow = { id: string; class_id: string | null; title: string; body: string; audience: string; created_by: string; published: boolean; created_at: string };

export function TeacherNoticesPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formAudience, setFormAudience] = useState("students");

  const load = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from("notices").select("*").eq("school_id", activeSchool.id).eq("published", true).order("created_at", { ascending: false });
    if (err) toast.error(`Load failed: ${err.message}`);
    setNotices((data ?? []) as NoticeRow[]);
    setLoading(false);
  }, [activeSchool, activeRole, user]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setShowForm(false); setEditingId(null); setFormClassId(""); setFormTitle(""); setFormBody(""); setFormAudience("students"); };

  const startEdit = (n: NoticeRow) => {
    setFormClassId(n.class_id ?? "");
    setFormTitle(n.title);
    setFormBody(n.body);
    setFormAudience(n.audience);
    setEditingId(n.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSchool || !user || !formClassId) return;
    setSaving(true);
    if (editingId) {
      const { error: err } = await supabase.from("notices").update({ class_id: formClassId, title: formTitle.trim(), body: formBody.trim(), audience: formAudience }).eq("id", editingId);
      setSaving(false);
      if (err) { toast.error(`Update failed: ${err.message}`); return; }
      toast.success("Notice updated");
    } else {
      const { error: err } = await supabase.from("notices").insert({ school_id: activeSchool.id, class_id: formClassId, title: formTitle.trim(), body: formBody.trim(), audience: formAudience, created_by: user.id });
      setSaving(false);
      if (err) { toast.error(`Create failed: ${err.message}`); return; }
      toast.success("Notice posted");
    }
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this notice?")) return;
    const { error: err } = await supabase.from("notices").delete().eq("id", id);
    if (err) { toast.error(`Delete failed: ${err.message}`); return; }
    toast.success("Notice deleted");
    await load();
  };

  if (!ready) return <AppShell title="Notices"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Notices"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Notices"><Panel title="No school">Ask your principal to assign your account.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Notices"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  return (
    <AppShell title="Notices" subtitle={`${activeSchool.name} · View and create notices`}>
      <div className="space-y-6">
        {classesLoading ? <div className="surface-panel h-20 animate-pulse" /> : classes.length === 0 ? (
          <Panel title="No classes assigned"><p className="py-6 text-center text-sm text-muted-foreground">Ask your principal to assign a class.</p></Panel>
        ) : (
          <>
            {!showForm ? (
              <Button onClick={() => { setShowForm(true); setEditingId(null); }}><Plus className="mr-2 h-4 w-4" />New notice</Button>
            ) : (
              <Panel title={editingId ? "Edit Notice" : "New Notice"}>
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
                      <Label>Audience</Label>
                      <select required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={formAudience} onChange={(e) => setFormAudience(e.target.value)}>
                        <option value="students">Students</option>
                        <option value="parents">Parents</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input required maxLength={200} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Notice title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Message</Label>
                    <Textarea rows={4} value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Notice content" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? "Posting…" : editingId ? "Update" : "Post notice"}</Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  </div>
                </form>
              </Panel>
            )}
          </>
        )}

        <Panel title="All Notices" subtitle={`${notices.length} notice(s)`}>
          {loading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : notices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notices yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notices.map((n) => {
                const cls = n.class_id ? classes.find((c) => c.id === n.class_id) : null;
                const isMine = n.created_by === user.id;
                return (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex items-start gap-3">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cls ? classLabel(cls) : "School-wide"} · {n.audience} · {new Date(n.created_at).toLocaleDateString("en-IN")}
                        </p>
                        {n.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Pill tone={n.audience === "students" ? "navy" : "muted"}>{n.audience}</Pill>
                      {isMine && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(n)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => void handleDelete(n.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
