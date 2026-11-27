"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Pencil, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/school-data";

const PAGE_SIZE = 25;
const STAGES = ["new", "contacted", "visit_scheduled", "applied", "enrolled", "lost"] as const;
const SOURCES = ["walk_in", "phone", "website", "referral", "other"] as const;

type EnquiryRow = {
  id: string;
  child_name: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  target_class: string;
  source: string;
  stage: string;
  follow_up_date: string | null;
  notes: string;
  created_at: string;
};

const emptyForm = () => ({
  child_name: "",
  parent_name: "",
  parent_phone: "",
  parent_email: "",
  target_class: "",
  source: "walk_in",
  stage: "new",
  follow_up_date: "",
  notes: "",
});

const stageTone = (stage: string) =>
  stage === "enrolled" ? "navy" : stage === "lost" ? "red" : "muted";

export function AdmissionsPage() {
  const { user, activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EnquiryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<EnquiryRow | null>(null);

  const enquiriesQuery = useQuery<{ rows: EnquiryRow[]; total: number }, Error>({
    queryKey: ["school-enquiries", activeSchool?.id, page, search, stageFilter, dueOnly],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return { rows: [], total: 0 };
      let q = supabase
        .from("admission_enquiries")
        .select(
          "id,child_name,parent_name,parent_phone,parent_email,target_class,source,stage,follow_up_date,notes,created_at",
          { count: "exact" },
        )
        .eq("school_id", activeSchool.id)
        .order("follow_up_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (stageFilter !== "all") q = q.eq("stage", stageFilter);
      if (dueOnly) {
        q = q.lte("follow_up_date", todayISO()).not("stage", "in", "(enrolled,lost)");
      }
      if (search.trim()) {
        const term = search.trim().replaceAll(",", " ");
        q = q.or(`child_name.ilike.%${term}%,parent_name.ilike.%${term}%,parent_phone.ilike.%${term}%`);
      }

      const { data, count, error } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as EnquiryRow[], total: count ?? 0 };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school-enquiries", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const payload = {
        school_id: activeSchool.id,
        child_name: form.child_name.trim(),
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        parent_email: form.parent_email.trim(),
        target_class: form.target_class.trim(),
        source: form.source,
        stage: form.stage,
        follow_up_date: form.follow_up_date || null,
        notes: form.notes.trim(),
      };
      if (editing) {
        const { error } = await supabase.from("admission_enquiries").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("admission_enquiries")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Enquiry updated" : "Enquiry created");
      setDialogOpen(false);
      setEditing(null);
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admission_enquiries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      toast.success("Enquiry deleted");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Admissions"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Admissions"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Admissions"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const rows = enquiriesQuery.data?.rows ?? [];
  const total = enquiriesQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: EnquiryRow) => {
    setEditing(row);
    setForm({
      child_name: row.child_name,
      parent_name: row.parent_name,
      parent_phone: row.parent_phone,
      parent_email: row.parent_email,
      target_class: row.target_class,
      source: row.source,
      stage: row.stage,
      follow_up_date: row.follow_up_date ?? "",
      notes: row.notes,
    });
    setDialogOpen(true);
  };

  return (
    <AppShell
      title="Admissions"
      subtitle={`${activeSchool.name} · ${total} matching enquiry record(s)`}
      actions={
        <Button size="sm" disabled={!isWritable} onClick={openAdd}>
          <FilePlus2 className="mr-1.5 h-4 w-4" /> New enquiry
        </Button>
      }
    >
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Admissions" }]} />

        <Panel>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search enquiries"
                placeholder="Search child, parent, or phone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Stage filter"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPage(0); }}
            >
              <option value="all">All stages</option>
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {st.replace("_", " ")}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dueOnly}
                onChange={(e) => { setDueOnly(e.target.checked); setPage(0); }}
              />
              Follow-up due
            </label>
          </div>

          {enquiriesQuery.error && (
            <p role="alert" className="py-4 text-sm text-destructive">{enquiriesQuery.error.message}</p>
          )}

          {enquiriesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading enquiries…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No enquiries match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Child</th>
                    <th className="px-3 py-2.5 font-medium">Class</th>
                    <th className="px-3 py-2.5 font-medium">Parent</th>
                    <th className="px-3 py-2.5 font-medium">Stage</th>
                    <th className="px-3 py-2.5 font-medium">Follow-up</th>
                    <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface/60">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{row.child_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{row.source.replace("_", " ")}</p>
                      </td>
                      <td className="px-3 py-2.5">{row.target_class || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {row.parent_name || "—"}
                        {row.parent_phone && <span className="block text-xs">{row.parent_phone}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={stageTone(row.stage)}>{row.stage.replace("_", " ")}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {row.follow_up_date ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit enquiry for ${row.child_name}`}
                            disabled={!isWritable}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete enquiry for ${row.child_name}`}
                            disabled={!isWritable}
                            onClick={() => setConfirmDelete(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {pageCount} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!saveMut.isPending) setDialogOpen(o); }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit admission enquiry" : "New admission enquiry"}</DialogTitle>
            <DialogDescription>Track prospective students from first contact through enrolment.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (isWritable && form.child_name.trim()) saveMut.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Label>Child name *</Label>
              <Input required value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Target class</Label>
              <Input placeholder="e.g. Class 1" value={form.target_class} onChange={(e) => setForm({ ...form, target_class: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Parent name</Label>
              <Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Parent phone</Label>
              <Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Parent email</Label>
              <Input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Follow-up date</Label>
              <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMut.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isWritable || saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : editing ? "Save enquiry" : "Create enquiry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title="Delete enquiry"
        description={`Delete admission enquiry for "${confirmDelete?.child_name ?? ""}"?`}
        confirmLabel="Delete"
        destructive
        busy={deleteMut.isPending}
        onConfirm={() => { if (confirmDelete) deleteMut.mutate(confirmDelete.id); }}
      />
    </AppShell>
  );
}
