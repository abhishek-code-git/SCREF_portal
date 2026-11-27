"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lock, Plus, Unlock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type ExamRow = { id: string; name: string; exam_date: string | null; status: "draft" | "marks_open" | "published" };
type ClassRow = { id: string; name: string; section: string };
type ResultRow = {
  student_id: string;
  admission_no: string | null;
  roll_no: number;
  full_name: string;
  total_obtained: number;
  total_max: number;
  percentage: number;
  exam_rank: number | null;
  subjects_entered: number;
};

const statusTone = (s: ExamRow["status"]) => (s === "published" ? "navy" : s === "marks_open" ? "red" : "muted");

export function ExamsPage() {
  const { user, activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [confirmPublish, setConfirmPublish] = useState<ExamRow | null>(null);

  const metaQuery = useQuery({
    queryKey: ["school-exams-meta", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      const [exRes, clsRes] = await Promise.all([
        supabase.from("exams").select("id,name,exam_date,status").eq("school_id", activeSchool.id).order("created_at", { ascending: false }),
        supabase.from("classes").select("id,name,section").eq("school_id", activeSchool.id).order("name").order("section"),
      ]);
      const err = exRes.error ?? clsRes.error;
      if (err) throw err;
      return {
        exams: (exRes.data ?? []) as ExamRow[],
        classes: (clsRes.data ?? []) as ClassRow[],
      };
    },
  });

  const activeExamId = selectedExamId || metaQuery.data?.exams[0]?.id || "";
  const activeClassId = selectedClassId || metaQuery.data?.classes[0]?.id || "";

  const resultsQuery = useQuery<ResultRow[], Error>({
    queryKey: ["exam-result-summary", activeSchool?.id, activeExamId, activeClassId],
    enabled: !!activeSchool && !!activeExamId && !!activeClassId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exam_result_summary", {
        _exam_id: activeExamId,
        _class_id: activeClassId,
      });
      if (error) throw error;
      return (data ?? []) as ResultRow[];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school-exams-meta", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["exam-result-summary", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
  };

  const createExamMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const { error } = await supabase.from("exams").insert({
        school_id: activeSchool.id,
        name: examName.trim(),
        exam_date: examDate || null,
        status: "marks_open",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setExamName("");
      setExamDate("");
      toast.success("Exam created with marks entry open");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ExamRow["status"] }) => {
      const { error } = await supabase.from("exams").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      setConfirmPublish(null);
      toast.success(`Exam status updated to ${vars.status.replace("_", " ")}`);
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Exams & Results"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Exams & Results"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Exams & Results"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const exams = metaQuery.data?.exams ?? [];
  const classes = metaQuery.data?.classes ?? [];
  const results = resultsQuery.data ?? [];

  return (
    <AppShell title="Exams & Results" subtitle={`${activeSchool.name} · Examinations and class mark sheets`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Exams & Results" }]} />

        <Panel title="Create exam" subtitle="Open marks entry for teachers immediately, then publish when ready">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (isWritable && examName.trim()) createExamMut.mutate();
            }}
            className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
          >
            <Input
              required
              placeholder="Exam name (e.g. Unit Test 1)"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              disabled={!isWritable || createExamMut.isPending}
            />
            <Input
              type="date"
              aria-label="Exam date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              disabled={!isWritable || createExamMut.isPending}
            />
            <Button type="submit" disabled={!isWritable || !examName.trim() || createExamMut.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {createExamMut.isPending ? "Creating…" : "Create exam"}
            </Button>
          </form>
        </Panel>

        <Panel title="School exams" subtitle="Control marks entry windows and publish results">
          {metaQuery.isPending ? (
            <p className="py-4 text-sm text-muted-foreground">Loading exams…</p>
          ) : exams.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No exams created yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {exams.map((ex) => (
                <li key={ex.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{ex.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ex.exam_date ? `Date: ${ex.exam_date}` : "No exam date set"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={statusTone(ex.status)}>{ex.status.replace("_", " ")}</Pill>
                    {ex.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isWritable || statusMut.isPending}
                        onClick={() => statusMut.mutate({ id: ex.id, status: "marks_open" })}
                      >
                        <Unlock className="mr-1.5 h-3.5 w-3.5" /> Open marks
                      </Button>
                    )}
                    {ex.status === "marks_open" && (
                      <Button
                        size="sm"
                        disabled={!isWritable || statusMut.isPending}
                        onClick={() => setConfirmPublish(ex)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Publish results
                      </Button>
                    )}
                    {ex.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isWritable || statusMut.isPending}
                        onClick={() => statusMut.mutate({ id: ex.id, status: "marks_open" })}
                      >
                        <Lock className="mr-1.5 h-3.5 w-3.5" /> Reopen marks
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Class result sheet" subtitle="Aggregated student totals, percentage, and dense rank">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Exam</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={activeExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={activeClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}-{c.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!activeExamId || !activeClassId ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Create an exam and class to view results.</p>
          ) : resultsQuery.isPending ? (
            <p className="py-6 text-sm text-muted-foreground">Calculating class results…</p>
          ) : resultsQuery.error ? (
            <p role="alert" className="py-4 text-sm text-destructive">{resultsQuery.error.message}</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Rank</th>
                    <th className="px-3 py-2.5 font-medium">Roll</th>
                    <th className="px-3 py-2.5 font-medium">Student</th>
                    <th className="px-3 py-2.5 font-medium text-right">Subjects</th>
                    <th className="px-3 py-2.5 font-medium text-right">Total</th>
                    <th className="px-3 py-2.5 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r) => (
                    <tr key={r.student_id}>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">{r.exam_rank ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.roll_no}</td>
                      <td className="px-3 py-2.5 font-medium">{r.full_name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.subjects_entered}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.total_obtained} / {r.total_max}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={!!confirmPublish}
        onOpenChange={(o) => { if (!o) setConfirmPublish(null); }}
        title="Publish exam results"
        description={`Publish "${confirmPublish?.name ?? ""}"? Teachers will no longer be able to edit marks once published.`}
        confirmLabel="Publish results"
        busy={statusMut.isPending}
        onConfirm={() => { if (confirmPublish) statusMut.mutate({ id: confirmPublish.id, status: "published" }); }}
      />
    </AppShell>
  );
}
