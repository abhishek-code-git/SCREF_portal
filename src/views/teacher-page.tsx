"use client";

import { CalendarCheck, Clock, BookOpen, PenLine, Megaphone, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { useSchoolContext } from "@/hooks/use-school";
import { useTeacherClasses } from "@/hooks/use-teacher-classes";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, todayISO } from "@/lib/school-data";

type TimetableSlot = { id: string; class_id: string; subject_id: string | null; day_of_week: number; period: number; start_time: string; end_time: string };
type HomeworkRow = { id: string; class_id: string; title: string; due_date: string | null };
type ExamRow = { id: string; name: string; status: string };
type NoticeRow = { id: string; title: string; created_at: string };

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayDow(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
}

export function TeacherPage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [unmarkedClasses, setUnmarkedClasses] = useState<string[]>([]);
  const [upcomingHw, setUpcomingHw] = useState<(HomeworkRow & { className: string })[]>([]);
  const [openExams, setOpenExams] = useState<ExamRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setLoading(false); return; }
    setLoading(true);
    const today = todayISO();
    const dow = todayDow();

    const [slotsRes, attRes, hwRes, examsRes, noticesRes] = await Promise.all([
      supabase.from("timetable_slots").select("id,class_id,subject_id,day_of_week,period,start_time,end_time").eq("school_id", activeSchool.id).eq("teacher_user_id", user.id).eq("day_of_week", dow).order("period"),
      supabase.from("attendance_records").select("class_id").eq("school_id", activeSchool.id).eq("att_date", today),
      supabase.from("homework").select("id,class_id,title,due_date").eq("school_id", activeSchool.id).eq("created_by", user.id).gte("due_date", today).order("due_date").limit(5),
      supabase.from("exams").select("id,name,status").eq("school_id", activeSchool.id).eq("status", "marks_open"),
      supabase.from("notices").select("id,title,created_at").eq("school_id", activeSchool.id).eq("published", true).order("created_at", { ascending: false }).limit(5),
    ]);

    setSlots((slotsRes.data ?? []) as TimetableSlot[]);

    // Figure out which of my classes have no attendance marked today
    const markedClassIds = new Set((attRes.data ?? []).map((r) => r.class_id));
    setUnmarkedClasses(classes.filter((c) => !markedClassIds.has(c.id)).map((c) => c.id));

    setUpcomingHw((hwRes.data ?? []).map((h) => {
      const cls = classes.find((c) => c.id === (h as HomeworkRow).class_id);
      return { ...(h as HomeworkRow), className: cls ? classLabel(cls) : "Class" };
    }));
    setOpenExams((examsRes.data ?? []) as ExamRow[]);
    setNotices((noticesRes.data ?? []) as NoticeRow[]);
    setLoading(false);
  }, [activeSchool, activeRole, user, classes]);

  useEffect(() => { if (classes.length > 0 || !classesLoading) void loadToday(); }, [loadToday, classes, classesLoading]);

  if (!ready) return <AppShell title="Teacher's Desk"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Teacher's Desk"><Panel title="School access unavailable">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="Teacher's Desk"><Panel title="No school assigned">Ask your principal to assign your account to a school.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="Teacher's Desk"><Panel title="Choose your teacher workspace">Select an active teacher membership to view assigned classes.</Panel></AppShell>;

  const isLoading = loading || classesLoading;

  return (
    <AppShell title="Teacher's Desk" subtitle={`${activeSchool.name} · Today`}>
      <div className="space-y-6">
        <StatGrid items={[
          ["My Classes", isLoading ? "…" : String(classes.length), "Assigned to you"],
          ["Today's Periods", isLoading ? "…" : String(slots.length), DAY_NAMES[todayDow()] ?? ""],
          ["Attendance Pending", isLoading ? "…" : String(unmarkedClasses.length), "Classes unmarked today"],
          ["Open Exams", isLoading ? "…" : String(openExams.length), "Marks entry available"],
        ]} />

        {classes.length === 0 && !isLoading && (
          <Panel title="No classes assigned">
            <p className="py-8 text-center text-sm text-muted-foreground">Ask your principal to assign a class to your account.</p>
          </Panel>
        )}

        {/* Today's periods */}
        <Panel title="Today's Timetable" subtitle={`${DAY_NAMES[todayDow()]} · ${slots.length} period(s)`} action={<Link href="/teacher/timetable" className="text-xs text-primary hover:underline">Full timetable →</Link>}>
          {isLoading ? <p className="py-6 text-sm text-muted-foreground">Loading…</p> : slots.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No periods scheduled for today.</p> : (
            <ul className="divide-y divide-border">
              {slots.map((slot) => {
                const cls = classes.find((c) => c.id === slot.class_id);
                return (
                  <li key={slot.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{slot.period}</span>
                      <div>
                        <p className="text-sm font-medium">{cls ? classLabel(cls) : "Class"}</p>
                        <p className="text-xs text-muted-foreground">Period {slot.period}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Attendance pending */}
          <Panel title="Attendance Pending" subtitle="Classes with no attendance marked today" action={<Link href="/teacher/attendance" className="text-xs text-primary hover:underline">Mark attendance →</Link>}>
            {isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : unmarkedClasses.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <CalendarCheck className="h-4 w-4 text-green-600" /> All classes marked for today
              </div>
            ) : (
              <ul className="space-y-2">
                {unmarkedClasses.map((cid) => {
                  const cls = classes.find((c) => c.id === cid);
                  return cls ? (
                    <li key={cid} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <span className="text-sm font-medium">{classLabel(cls)}</span>
                      <Link href="/teacher/attendance" className="text-xs font-medium text-primary hover:underline">Mark now</Link>
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </Panel>

          {/* Upcoming homework */}
          <Panel title="Upcoming Homework" subtitle="Due soon" action={<Link href="/teacher/homework" className="text-xs text-primary hover:underline">All homework →</Link>}>
            {isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : upcomingHw.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No upcoming homework.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingHw.map((hw) => (
                  <li key={hw.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{hw.title}</p>
                      <p className="text-xs text-muted-foreground">{hw.className}</p>
                    </div>
                    {hw.due_date && <span className="whitespace-nowrap text-xs text-muted-foreground">Due {hw.due_date}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Open exams */}
          <Panel title="Open Exams" subtitle="Marks entry available" action={<Link href="/teacher/marks" className="text-xs text-primary hover:underline">Enter marks →</Link>}>
            {isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : openExams.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No exams with open marks entry.</p>
            ) : (
              <ul className="divide-y divide-border">
                {openExams.map((exam) => (
                  <li key={exam.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <PenLine className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{exam.name}</span>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-400">Open</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Latest notices */}
          <Panel title="Latest Notices" action={<Link href="/teacher/notices" className="text-xs text-primary hover:underline">All notices →</Link>}>
            {isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading…</p> : notices.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No recent notices.</p>
            ) : (
              <ul className="divide-y divide-border">
                {notices.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{n.title}</span>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "My Classes", to: "/teacher/classes", icon: Users, desc: "View students" },
            { label: "Homework", to: "/teacher/homework", icon: BookOpen, desc: "Assign work" },
            { label: "Marks", to: "/teacher/marks", icon: PenLine, desc: "Enter exam marks" },
            { label: "Notices", to: "/teacher/notices", icon: Megaphone, desc: "Post a notice" },
          ].map((item) => (
            <Link key={item.to} href={item.to} className="surface-panel flex items-center gap-3 p-4 transition-colors hover:bg-secondary/50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
