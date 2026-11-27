"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/kit";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { classLabel, type ClassRow } from "@/lib/school-data";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

type Slot = { id: string; class_id: string; subject_id: string | null; day_of_week: number; period: number; start_time: string; end_time: string };
type SubjectMap = Record<string, string>;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TeacherTimetablePage() {
  const { user, activeSchool, activeRole, ready, error } = useSchoolContext();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") { setLoading(false); return; }
    setLoading(true);
    const [slotsRes, classesRes, subjectsRes] = await Promise.all([
      supabase.from("timetable_slots").select("id,class_id,subject_id,day_of_week,period,start_time,end_time").eq("school_id", activeSchool.id).eq("teacher_user_id", user.id).order("day_of_week").order("period"),
      supabase.from("classes").select("id,name,section,class_teacher").eq("school_id", activeSchool.id),
      supabase.from("subjects").select("id,name").eq("school_id", activeSchool.id),
    ]);
    setSlots((slotsRes.data ?? []) as Slot[]);
    setClasses((classesRes.data ?? []) as ClassRow[]);
    const smap: SubjectMap = {};
    for (const s of (subjectsRes.data ?? [])) smap[(s as { id: string; name: string }).id] = (s as { id: string; name: string }).name;
    setSubjects(smap);
    setLoading(false);
  }, [activeSchool, activeRole, user]);

  useEffect(() => { void load(); }, [load]);

  if (!ready) return <AppShell title="My Timetable"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="My Timetable"><Panel title="Error">{error}</Panel></AppShell>;
  if (!activeSchool || !user) return <AppShell title="My Timetable"><Panel title="No school">Ask your principal to assign your account.</Panel></AppShell>;
  if (activeRole !== "teacher") return <AppShell title="My Timetable"><Panel title="Not a teacher">Select your teacher membership.</Panel></AppShell>;

  const maxPeriod = slots.reduce((m, s) => Math.max(m, s.period), 0);
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  return (
    <AppShell title="My Timetable" subtitle={`${activeSchool.name} · Weekly schedule (read-only)`}>
      <Panel title="Weekly Timetable">
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading timetable…</p> : slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No timetable configured. Ask your principal to set up your timetable.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Period</th>
                  {DAYS.map((d) => <th key={d} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 text-xs font-semibold text-muted-foreground">{p}</td>
                    {DAYS.map((_, dayIdx) => {
                      const slot = slots.find((s) => s.day_of_week === dayIdx && s.period === p);
                      if (!slot) return <td key={dayIdx} className="px-3 py-3 text-center text-xs text-muted-foreground">—</td>;
                      const cls = classes.find((c) => c.id === slot.class_id);
                      const subj = slot.subject_id ? subjects[slot.subject_id] : null;
                      return (
                        <td key={dayIdx} className="px-2 py-2">
                          <div className="rounded-md bg-primary/10 p-2 text-center">
                            <p className="text-xs font-semibold">{cls ? classLabel(cls) : "Class"}</p>
                            {subj && <p className="text-[10px] text-muted-foreground">{subj}</p>}
                            <p className="text-[10px] text-muted-foreground">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
