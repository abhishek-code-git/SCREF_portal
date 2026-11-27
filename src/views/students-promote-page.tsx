"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type ClassRow = { id: string; name: string; section: string };
type StudentRow = { id: string; admission_no: string | null; full_name: string; roll_no: number };

export function StudentsPromotePage() {
  const { activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [movedCount, setMovedCount] = useState<number | null>(null);

  const classesQuery = useQuery<ClassRow[], Error>({
    queryKey: ["school-classes-options", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return [];
      const { data, error } = await supabase
        .from("classes")
        .select("id,name,section")
        .eq("school_id", activeSchool.id)
        .order("name")
        .order("section");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const studentsQuery = useQuery<StudentRow[], Error>({
    queryKey: ["promote-source-students", activeSchool?.id, fromClass],
    enabled: !!activeSchool && !!fromClass,
    queryFn: async () => {
      if (!activeSchool || !fromClass) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id,admission_no,full_name,roll_no")
        .eq("school_id", activeSchool.id)
        .eq("class_id", fromClass)
        .eq("status", "active")
        .order("roll_no")
        .order("full_name")
        .range(0, 499);
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
  });

  const promoteMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("promote_students", {
        _from_class: fromClass,
        _to_class: toClass,
        _student_ids: selectedIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (count) => {
      setConfirmOpen(false);
      setMovedCount(count);
      setSelectedIds([]);
      toast.success(`Promoted ${count} student(s)`);
      await queryClient.invalidateQueries({ queryKey: ["promote-source-students", activeSchool?.id] });
      await queryClient.invalidateQueries({ queryKey: ["school-students", activeSchool?.id] });
      await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Promote Students"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Promote Students"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Promote Students"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const fromObj = classes.find((c) => c.id === fromClass);
  const toObj = classes.find((c) => c.id === toClass);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <AppShell title="Promote Students" subtitle={`${activeSchool.name} · Batch class promotion`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb
          items={[
            { label: "Students", href: "/students" },
            { label: "Promote" },
          ]}
        />

        {movedCount !== null && (
          <div role="status" className="surface-panel flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Successfully promoted {movedCount} student(s) to {toObj ? `${toObj.name}-${toObj.section}` : "destination class"}.
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/students">Back to Students</Link>
            </Button>
          </div>
        )}

        <Panel title="1. Select source and destination classes" subtitle="Only active students in the source class can be promoted">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>From class</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={fromClass}
                onChange={(e) => {
                  setFromClass(e.target.value);
                  setSelectedIds([]);
                  setMovedCount(null);
                }}
              >
                <option value="">Choose source class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}-{c.section}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To class</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={toClass}
                onChange={(e) => setToClass(e.target.value)}
              >
                <option value="">Choose destination class</option>
                {classes
                  .filter((c) => c.id !== fromClass)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}-{c.section}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </Panel>

        {fromClass && (
          <Panel
            title="2. Choose students to promote"
            subtitle={`${selectedIds.length} of ${students.length} active student(s) selected`}
            action={
              students.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedIds(students.map((s) => s.id))}
                  >
                    Select all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
              )
            }
          >
            {studentsQuery.isPending ? (
              <p className="py-6 text-sm text-muted-foreground">Loading students…</p>
            ) : studentsQuery.error ? (
              <p className="py-4 text-sm text-destructive">{studentsQuery.error.message}</p>
            ) : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active students in this class.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {students.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <input
                        id={`stu-${s.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <label htmlFor={`stu-${s.id}`} className="flex flex-1 cursor-pointer items-center justify-between text-sm">
                        <span className="font-medium">
                          {s.roll_no}. {s.full_name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {s.admission_no ?? ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {fromObj && toObj
                  ? `Preview: Move ${selectedIds.length} student(s) from ${fromObj.name}-${fromObj.section} to ${toObj.name}-${toObj.section}`
                  : "Pick both classes and tick students to preview promotion."}
              </p>
              <Button
                disabled={!isWritable || !fromClass || !toClass || selectedIds.length === 0 || promoteMut.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Promote selected <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </Panel>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm batch promotion"
        description={`Move ${selectedIds.length} student(s) from ${fromObj?.name ?? ""}-${fromObj?.section ?? ""} to ${toObj?.name ?? ""}-${toObj?.section ?? ""}? This updates all selected students atomically.`}
        confirmLabel={`Promote ${selectedIds.length} student(s)`}
        busy={promoteMut.isPending}
        onConfirm={() => promoteMut.mutate()}
      />
    </AppShell>
  );
}
