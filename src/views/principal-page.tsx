"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  GraduationCap,
  Megaphone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, Pill, StatGrid } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type OverviewRow = {
  class_count: number;
  student_count: number;
  teacher_count: number;
  attendance_today_marked: number;
  attendance_today_present: number;
  classes_without_attendance_today: number;
  classes_without_class_teacher: number;
  classes_without_timetable: number;
  exams_open_for_marks: number;
  exams_ready_to_publish: number;
  enquiries_total: number;
  enquiries_followup_due: number;
  notices_last_7_days: number;
};

type Task = { id: string; title: string; done: boolean; due_date: string | null };
type NoticePreview = { id: string; title: string; audience: string; pinned: boolean; created_at: string };

function PrincipalTasks({ schoolId, isWritable }: { schoolId: string; isWritable: boolean }) {
  const { user } = useSchoolContext();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);

  const tasksQuery = useQuery<Task[], Error>({
    queryKey: ["principal-tasks", schoolId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_tasks")
        .select("id,title,done,due_date")
        .order("done")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("principal_tasks")
        .insert({ title: title.trim(), due_date: dueDate || null });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setDueDate("");
      toast.success("Task added");
      await queryClient.invalidateQueries({ queryKey: ["principal-tasks", schoolId, user?.id] });
    },
    onError: (err: Error) => toast.error(`Unable to add task: ${err.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase
        .from("principal_tasks")
        .update({ done: !task.done })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["principal-tasks", schoolId, user?.id] });
    },
    onError: (err: Error) => toast.error(`Unable to update task: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("principal_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      toast.success("Task removed");
      await queryClient.invalidateQueries({ queryKey: ["principal-tasks", schoolId, user?.id] });
    },
    onError: (err: Error) => toast.error(`Unable to delete task: ${err.message}`),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !isWritable) return;
    addMutation.mutate();
  };

  const tasks = tasksQuery.data ?? [];

  return (
    <Panel title="My tasks" subtitle="Private tasks saved to your account">
      <form onSubmit={handleSubmit} className="mb-4 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
        <Input
          required
          maxLength={180}
          placeholder="Add a school task"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={!isWritable || addMutation.isPending}
        />
        <Input
          type="date"
          aria-label="Task due date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          disabled={!isWritable || addMutation.isPending}
        />
        <Button type="submit" disabled={!isWritable || addMutation.isPending || !title.trim()}>
          <Plus className="mr-1.5 h-4 w-4" />
          {addMutation.isPending ? "Adding…" : "Add task"}
        </Button>
      </form>
      {tasksQuery.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">Loading tasks…</p>
      ) : tasksQuery.error ? (
        <p className="py-4 text-sm text-destructive">{tasksQuery.error.message}</p>
      ) : tasks.length ? (
        <ul className="divide-y divide-border">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                disabled={!isWritable || toggleMutation.isPending}
                className="flex-1 text-left text-sm disabled:opacity-70"
                onClick={() => toggleMutation.mutate(task)}
              >
                <span className={task.done ? "text-muted-foreground line-through" : ""}>
                  {task.title}
                </span>
                {task.due_date && (
                  <span className="ml-2 text-xs text-muted-foreground">Due {task.due_date}</span>
                )}
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete task ${task.title}`}
                disabled={!isWritable}
                onClick={() => setConfirmDelete(task)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">No tasks yet.</p>
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete task"
        description={`Remove "${confirmDelete?.title ?? ""}" from your tasks?`}
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); }}
      />
    </Panel>
  );
}

export function PrincipalPage() {
  const { activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);

  const overviewQuery = useQuery<OverviewRow | null, Error>({
    queryKey: ["principal-overview", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return null;
      const { data, error } = await supabase.rpc("principal_overview", {
        _school_id: activeSchool.id,
      });
      if (error) throw error;
      return (data?.[0] as OverviewRow | undefined) ?? null;
    },
  });

  const noticesQuery = useQuery<NoticePreview[], Error>({
    queryKey: ["principal-recent-notices", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return [];
      const { data, error } = await supabase
        .from("notices")
        .select("id,title,audience,pinned,created_at")
        .eq("school_id", activeSchool.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as NoticePreview[];
    },
  });

  if (!ready) {
    return (
      <AppShell title="Overview">
        <div className="surface-panel h-40 animate-pulse" />
      </AppShell>
    );
  }
  if (accessError) {
    return (
      <AppShell title="Overview">
        <Panel title="School access unavailable">{accessError}</Panel>
      </AppShell>
    );
  }
  if (!activeSchool) {
    return (
      <AppShell title="Overview">
        <Panel title="No school assigned">
          Ask your administrator to assign your principal membership to a school.
        </Panel>
      </AppShell>
    );
  }

  const o = overviewQuery.data;
  const loading = overviewQuery.isPending;
  const pct =
    o && o.attendance_today_marked > 0
      ? Math.round((o.attendance_today_present / o.attendance_today_marked) * 100)
      : null;

  const attentionItems = o
    ? [
        {
          count: o.classes_without_class_teacher,
          label: "classes without a class teacher",
          href: "/classes",
        },
        {
          count: o.classes_without_timetable,
          label: "classes without a timetable",
          href: "/classes?tab=timetable",
        },
        {
          count: o.exams_ready_to_publish,
          label: "exams with marks ready to publish",
          href: "/exams",
        },
        {
          count: o.enquiries_followup_due,
          label: "admission enquiries with follow-up due today or earlier",
          href: "/admissions",
        },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <AppShell
      title="Overview"
      subtitle={`${activeSchool.name} · ${activeSchool.academic_year}`}
    >
      <div className="space-y-6">
        {overviewQuery.error && (
          <div role="alert" className="surface-panel p-4 text-sm text-destructive">
            Unable to load school summary: {overviewQuery.error.message}
          </div>
        )}

        <StatGrid
          items={[
            ["Students", loading ? "…" : String(o?.student_count ?? 0), "Active enrolment"],
            ["Classes", loading ? "…" : String(o?.class_count ?? 0), "Configured sections"],
            ["Teachers", loading ? "…" : String(o?.teacher_count ?? 0), "Active memberships"],
            [
              "Attendance today",
              loading
                ? "…"
                : o && o.attendance_today_marked > 0
                  ? `${o.attendance_today_present} / ${o.attendance_today_marked} (${pct}%)`
                  : "0 marked",
              loading
                ? ""
                : `${o?.classes_without_attendance_today ?? 0} class(es) not marked today`,
            ],
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Needs attention"
            subtitle="Operational items requiring leadership review"
            action={
              <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
                View reports →
              </Link>
            }
          >
            {loading ? (
              <p className="py-4 text-sm text-muted-foreground">Checking school records…</p>
            ) : attentionItems.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <CalendarCheck className="h-4 w-4 text-emerald-600" />
                Everything looks up to date across classes, timetables, exams, and enquiries.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {attentionItems.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2.5 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        <strong className="tabular-nums">{item.count}</strong> {item.label}
                      </span>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.href}>
                        Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent notices"
            subtitle={loading ? "" : `${o?.notices_last_7_days ?? 0} posted in the last 7 days`}
            action={
              <Link href="/notices" className="text-xs font-medium text-primary hover:underline">
                Manage notices →
              </Link>
            }
          >
            {noticesQuery.isPending ? (
              <p className="py-4 text-sm text-muted-foreground">Loading notices…</p>
            ) : noticesQuery.error ? (
              <p className="py-4 text-sm text-destructive">{noticesQuery.error.message}</p>
            ) : (noticesQuery.data?.length ?? 0) === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No notices posted yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {noticesQuery.data!.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {n.pinned ? "📌 " : ""}
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <Pill tone="muted">{n.audience}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Quick actions" subtitle="Jump directly to core school workflows">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/students">
                <GraduationCap className="mr-1.5 h-4 w-4" /> Students
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/students/promote">
                <Users className="mr-1.5 h-4 w-4" /> Promote class
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/attendance">
                <CalendarCheck className="mr-1.5 h-4 w-4" /> Attendance
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/notices">
                <Megaphone className="mr-1.5 h-4 w-4" /> Notices
              </Link>
            </Button>
          </div>
        </Panel>

        <PrincipalTasks schoolId={activeSchool.id} isWritable={isWritable} />
      </div>
    </AppShell>
  );
}
