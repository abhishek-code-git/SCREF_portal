"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type NoticeRow = {
  id: string;
  class_id: string | null;
  title: string;
  body: string;
  audience: string;
  created_by: string;
  published: boolean;
  pinned: boolean;
  created_at: string;
};

type ClassItem = { id: string; name: string; section: string };

export function NoticesPage() {
  const { user, activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [audienceFilter, setAudienceFilter] = useState("all_filter");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NoticeRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [classId, setClassId] = useState("");
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<NoticeRow | null>(null);

  const noticesQuery = useQuery({
    queryKey: ["school-notices", activeSchool?.id, audienceFilter],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      let q = supabase
        .from("notices")
        .select("id,class_id,title,body,audience,created_by,published,pinned,created_at")
        .eq("school_id", activeSchool.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(0, 99);
      if (audienceFilter !== "all_filter") q = q.eq("audience", audienceFilter);

      const [nRes, clsRes] = await Promise.all([
        q,
        supabase.from("classes").select("id,name,section").eq("school_id", activeSchool.id).order("name"),
      ]);
      const err = nRes.error ?? clsRes.error;
      if (err) throw err;

      const notices = (nRes.data ?? []) as NoticeRow[];
      const creatorIds = [...new Set(notices.map((n) => n.created_by))];
      const profRes = creatorIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", creatorIds)
        : { data: [], error: null };
      if (profRes.error) throw profRes.error;
      const creators = new Map((profRes.data ?? []).map((p) => [p.user_id, p.full_name || "School Staff"]));

      return {
        notices,
        classes: (clsRes.data ?? []) as ClassItem[],
        creators,
      };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school-notices", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-recent-notices", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setTitle("");
    setBody("");
    setAudience("all");
    setClassId("");
    setPinned(false);
    setPublished(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool || !user) return;
      if (editing) {
        const { error } = await supabase
          .from("notices")
          .update({
            title: title.trim(),
            body: body.trim(),
            audience,
            class_id: classId || null,
            pinned,
            published,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notices").insert({
          school_id: activeSchool.id,
          class_id: classId || null,
          title: title.trim(),
          body: body.trim(),
          audience,
          pinned,
          published,
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Notice updated" : "Notice posted");
      resetForm();
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePinMut = useMutation({
    mutationFn: async (n: NoticeRow) => {
      const { error } = await supabase.from("notices").update({ pinned: !n.pinned }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Notice pin updated");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      toast.success("Notice deleted");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Notices"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Notices"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Notices"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const notices = noticesQuery.data?.notices ?? [];
  const classes = noticesQuery.data?.classes ?? [];
  const classMap = new Map(classes.map((c) => [c.id, `${c.name}-${c.section}`]));
  const creators = noticesQuery.data?.creators ?? new Map<string, string>();

  const startEdit = (n: NoticeRow) => {
    setEditing(n);
    setTitle(n.title);
    setBody(n.body);
    setAudience(n.audience);
    setClassId(n.class_id ?? "");
    setPinned(n.pinned);
    setPublished(n.published);
    setShowForm(true);
  };

  return (
    <AppShell
      title="Notices"
      subtitle={`${activeSchool.name} · School & class announcements`}
      actions={
        !showForm && (
          <Button size="sm" disabled={!isWritable} onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New notice
          </Button>
        )
      }
    >
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Notices" }]} />

        {showForm && (
          <Panel title={editing ? "Edit notice" : "Create notice"}>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (isWritable && title.trim()) saveMut.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Title *</Label>
                  <Input required value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>Audience</Label>
                  <select
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    <option value="all">Everyone (All)</option>
                    <option value="parents">Parents</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Scope (class or school-wide)</Label>
                  <select
                    disabled={!isWritable}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    <option value="">All classes (School-wide)</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}-{c.section}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-4 pb-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={!isWritable} />
                    Pin notice
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={!isWritable} />
                    Published
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Message</Label>
                <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} disabled={!isWritable} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saveMut.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isWritable || !title.trim() || saveMut.isPending}>
                  {saveMut.isPending ? "Saving…" : editing ? "Save notice" : "Post notice"}
                </Button>
              </div>
            </form>
          </Panel>
        )}

        <Panel
          title="All notices"
          action={
            <select
              aria-label="Filter by audience"
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs sm:text-sm"
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
            >
              <option value="all_filter">All audiences</option>
              <option value="all">Everyone</option>
              <option value="parents">Parents</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
            </select>
          }
        >
          {noticesQuery.isPending ? (
            <p className="py-6 text-sm text-muted-foreground">Loading notices…</p>
          ) : noticesQuery.error ? (
            <p role="alert" className="py-4 text-sm text-destructive">{noticesQuery.error.message}</p>
          ) : notices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Megaphone className="mx-auto mb-2 h-6 w-6 opacity-50" />
              No notices match this filter.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notices.map((n) => (
                <li key={n.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{n.title}</h3>
                        {n.pinned && <Pill tone="red">Pinned</Pill>}
                        <Pill tone="navy">{n.audience}</Pill>
                        <Pill tone="muted">{n.class_id ? classMap.get(n.class_id) ?? "Class" : "School-wide"}</Pill>
                        {!n.published && <Pill tone="muted">Draft</Pill>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        By {creators.get(n.created_by) ?? "School Staff"} · {new Date(n.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                        disabled={!isWritable || togglePinMut.isPending}
                        onClick={() => togglePinMut.mutate(n)}
                      >
                        {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${n.title}`}
                        disabled={!isWritable}
                        onClick={() => startEdit(n)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${n.title}`}
                        disabled={!isWritable}
                        onClick={() => setConfirmDelete(n)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {n.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title="Delete notice"
        description={`Delete "${confirmDelete?.title ?? ""}"?`}
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => { if (confirmDelete) deleteMut.mutate(confirmDelete.id); }}
      />
    </AppShell>
  );
}
