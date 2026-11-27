"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, FileCheck2, Printer } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Field, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
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

type StudentRecord = {
  id: string;
  school_id: string;
  class_id: string;
  admission_no: string | null;
  full_name: string;
  roll_no: number;
  date_of_birth: string | null;
  gender: string | null;
  parent_name: string;
  parent_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  address: string;
  admitted_on: string;
  left_on: string | null;
  leaving_reason: string;
  status: string;
};

type ClassItem = { id: string; name: string; section: string };
type AttSummary = { present: number; absent: number; late: number; leave: number; total: number };
type MarkEntry = {
  id: string;
  marks_obtained: number;
  max_marks: number;
  exam_name: string;
  exam_date: string | null;
  subject_name: string;
};

function summarizeAtt(records: Array<{ status: string }>): AttSummary {
  const tally = { present: 0, absent: 0, late: 0, leave: 0, total: records.length };
  for (const r of records) {
    if (r.status === "present") tally.present++;
    else if (r.status === "absent") tally.absent++;
    else if (r.status === "late") tally.late++;
    else if (r.status === "leave") tally.leave++;
  }
  return tally;
}

export function StudentDetailPage({ studentId }: { studentId: string }) {
  const { activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [moveOpen, setMoveOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState("");
  const [tcOpen, setTcOpen] = useState(false);
  const [tcReason, setTcReason] = useState("");
  const [tcConduct, setTcConduct] = useState("Good");
  const [tcRemarks, setTcRemarks] = useState("");

  const detailQuery = useQuery({
    queryKey: ["student-detail", activeSchool?.id, studentId],
    enabled: !!activeSchool && !!studentId,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      const now = Date.now();
      const d30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
      const d90 = new Date(now - 90 * 86400000).toISOString().slice(0, 10);

      const [studRes, clsRes, attRes, tcRes, marksRes] = await Promise.all([
        supabase
          .from("students")
          .select("*")
          .eq("id", studentId)
          .eq("school_id", activeSchool.id)
          .maybeSingle(),
        supabase.from("classes").select("id,name,section").eq("school_id", activeSchool.id).order("name").order("section"),
        supabase
          .from("attendance_records")
          .select("att_date,status")
          .eq("school_id", activeSchool.id)
          .eq("student_id", studentId)
          .gte("att_date", d90)
          .limit(200),
        supabase
          .from("transfer_certificates")
          .select("id,tc_no,issued_on,reason")
          .eq("school_id", activeSchool.id)
          .eq("student_id", studentId)
          .maybeSingle(),
        supabase
          .from("exam_marks")
          .select("id,marks_obtained,max_marks,exam_id,subject_id")
          .eq("school_id", activeSchool.id)
          .eq("student_id", studentId)
          .limit(300),
      ]);

      const err = studRes.error ?? clsRes.error ?? attRes.error ?? tcRes.error ?? marksRes.error;
      if (err) throw err;
      if (!studRes.data) return null;

      const attRows = (attRes.data ?? []) as Array<{ att_date: string; status: string }>;
      const att90 = summarizeAtt(attRows);
      const att30 = summarizeAtt(attRows.filter((r) => r.att_date >= d30));

      const rawMarks = (marksRes.data ?? []) as Array<{
        id: string;
        marks_obtained: number;
        max_marks: number;
        exam_id: string;
        subject_id: string;
      }>;
      let publishedMarks: MarkEntry[] = [];
      if (rawMarks.length > 0) {
        const examIds = [...new Set(rawMarks.map((m) => m.exam_id))];
        const subIds = [...new Set(rawMarks.map((m) => m.subject_id))];
        const [exRes, subRes] = await Promise.all([
          supabase.from("exams").select("id,name,exam_date,status").in("id", examIds).eq("status", "published"),
          supabase.from("subjects").select("id,name").in("id", subIds),
        ]);
        if (exRes.error) throw exRes.error;
        if (subRes.error) throw subRes.error;
        const examMap = new Map((exRes.data ?? []).map((e) => [e.id, e]));
        const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
        publishedMarks = rawMarks
          .filter((m) => examMap.has(m.exam_id))
          .map((m) => {
            const ex = examMap.get(m.exam_id)!;
            return {
              id: m.id,
              marks_obtained: m.marks_obtained,
              max_marks: m.max_marks,
              exam_name: ex.name,
              exam_date: ex.exam_date,
              subject_name: subMap.get(m.subject_id) ?? "Subject",
            };
          });
      }

      return {
        student: studRes.data as StudentRecord,
        classes: (clsRes.data ?? []) as ClassItem[],
        att30,
        att90,
        tc: tcRes.data,
        publishedMarks,
      };
    },
  });

  const moveClassMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool || !targetClassId) return;
      const { error } = await supabase
        .from("students")
        .update({ class_id: targetClassId })
        .eq("id", studentId)
        .eq("school_id", activeSchool.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Student moved to selected class");
      setMoveOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["student-detail", activeSchool?.id, studentId] });
      await queryClient.invalidateQueries({ queryKey: ["school-students", activeSchool?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const issueTcMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("issue_transfer_certificate", {
        _student_id: studentId,
        _reason: tcReason.trim(),
        _conduct: tcConduct.trim() || "Good",
        _remarks: tcRemarks.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (tc) => {
      toast.success(`Transfer Certificate ${tc.tc_no} issued`);
      setTcOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["student-detail", activeSchool?.id, studentId] });
      await queryClient.invalidateQueries({ queryKey: ["school-students", activeSchool?.id] });
      await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!ready) return <AppShell title="Student Profile"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Student Profile"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Student Profile"><Panel title="No school">Select a school first.</Panel></AppShell>;

  const data = detailQuery.data;
  const student = data?.student;
  const classes = data?.classes ?? [];
  const currentClass = classes.find((c) => c.id === student?.class_id);

  return (
    <AppShell
      title={student ? student.full_name : "Student Profile"}
      subtitle={
        student
          ? `${student.admission_no ?? "No Adm No"} · ${currentClass ? `${currentClass.name}-${currentClass.section}` : ""}`
          : activeSchool.name
      }
      actions={
        student && (
          <div className="flex flex-wrap gap-2">
            {data?.tc ? (
              <Button asChild size="sm">
                <Link href={`/students/${student.id}/transfer-certificate`}>
                  <Printer className="mr-1.5 h-4 w-4" /> View / Print TC ({data.tc.tc_no})
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isWritable || student.status !== "active"}
                  onClick={() => {
                    setTargetClassId(student.class_id);
                    setMoveOpen(true);
                  }}
                >
                  <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Move class
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!isWritable || student.status !== "active"}
                  onClick={() => setTcOpen(true)}
                >
                  <FileCheck2 className="mr-1.5 h-4 w-4" /> Issue transfer certificate
                </Button>
              </>
            )}
          </div>
        )
      }
    >
      <div className="space-y-6">
        <PrincipalBreadcrumb
          items={[
            { label: "Students", href: "/students" },
            { label: student?.full_name ?? "Student" },
          ]}
        />

        {detailQuery.isPending ? (
          <div className="surface-panel h-40 animate-pulse" />
        ) : detailQuery.error ? (
          <Panel title="Unable to load student">{detailQuery.error.message}</Panel>
        ) : !student ? (
          <Panel title="Student not found">This student record was not found in the active school.</Panel>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Student profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admission No" value={student.admission_no ?? "—"} />
                  <Field label="Status" value={<Pill tone={student.status === "active" ? "navy" : "muted"}>{student.status}</Pill>} />
                  <Field label="Class & Section" value={currentClass ? `${currentClass.name}-${currentClass.section}` : "—"} />
                  <Field label="Roll Number" value={student.roll_no} />
                  <Field label="Date of Birth" value={student.date_of_birth ?? "—"} />
                  <Field label="Gender" value={student.gender ?? "—"} />
                  <Field label="Admitted On" value={student.admitted_on} />
                  {student.left_on && <Field label="Left On" value={student.left_on} />}
                  {student.leaving_reason && <Field label="Leaving Reason" value={student.leaving_reason} />}
                </div>
              </Panel>

              <Panel title="Parent & guardian details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Parent Name" value={student.parent_name || "—"} />
                  <Field label="Parent Phone" value={student.parent_phone || "—"} />
                  <Field label="Guardian Name" value={student.guardian_name || "—"} />
                  <Field label="Guardian Phone" value={student.guardian_phone || "—"} />
                  <Field label="Guardian Email" value={student.guardian_email || "—"} />
                  <Field label="Address" value={student.address || "—"} />
                </div>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Attendance summary" subtitle="Based on recorded school days">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "Last 30 days", s: data.att30 },
                    { label: "Last 90 days", s: data.att90 },
                  ].map(({ label, s }) => {
                    const pct = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null;
                    return (
                      <div key={label} className="rounded-lg border border-border p-4">
                        <div className="flex items-baseline justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="font-display text-xl font-semibold tabular-nums">
                            {pct === null ? "—" : `${pct}%`}
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Present: {s.present} · Absent: {s.absent} · Late: {s.late} · Leave: {s.leave} ({s.total} marked)
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Published exam marks" subtitle="Results from exams marked as published">
                {data.publishedMarks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No published exam marks yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Exam</th>
                          <th className="py-2 pr-3 font-medium">Subject</th>
                          <th className="py-2 text-right font-medium">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.publishedMarks.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2 pr-3 font-medium">{m.exam_name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{m.subject_name}</td>
                            <td className="py-2 text-right tabular-nums">
                              {m.marks_obtained} / {m.max_marks}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>

      {/* Move Class Dialog */}
      <Dialog open={moveOpen} onOpenChange={(o) => { if (!moveClassMut.isPending) setMoveOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move class</DialogTitle>
            <DialogDescription>Select the destination class for {student?.full_name}.</DialogDescription>
          </DialogHeader>
          <select
            aria-label="Destination class"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}-{c.section}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moveClassMut.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!isWritable || !targetClassId || targetClassId === student?.class_id || moveClassMut.isPending}
              onClick={() => moveClassMut.mutate()}
            >
              {moveClassMut.isPending ? "Moving…" : "Move student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Transfer Certificate Dialog */}
      <Dialog open={tcOpen} onOpenChange={(o) => { if (!issueTcMut.isPending) setTcOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue transfer certificate</DialogTitle>
            <DialogDescription>
              This marks {student?.full_name} as &ldquo;left&rdquo; and generates an official sequential TC number. This action cannot be undone by school staff.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (isWritable && tcReason.trim()) issueTcMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Reason for leaving *</Label>
              <Input
                required
                placeholder="e.g. Parent relocation"
                value={tcReason}
                onChange={(e) => setTcReason(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Conduct</Label>
              <Input value={tcConduct} onChange={(e) => setTcConduct(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Remarks (optional)</Label>
              <Textarea rows={3} value={tcRemarks} onChange={(e) => setTcRemarks(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTcOpen(false)} disabled={issueTcMut.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!isWritable || !tcReason.trim() || issueTcMut.isPending}>
                {issueTcMut.isPending ? "Issuing…" : "Issue TC & mark left"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
