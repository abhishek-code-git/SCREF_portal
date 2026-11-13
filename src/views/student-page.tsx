"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Panel, StatGrid } from "@/components/kit";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type StudentHome = {
  name: string;
  roll: number;
  className: string;
  schoolName: string;
  attendance: { date: string; status: string }[];
};

export function StudentPage() {
  const { user, activeRole, activeSchool, ready, error } = useSchoolContext();
  const query = useQuery<StudentHome | null, Error>({
    queryKey: ["student-home", user?.id],
    enabled: ready && !!user && activeRole === "student",
    queryFn: async () => {
      if (!user) return null;
      const { data: student, error: studentError } = await supabase.from("students").select("id,full_name,roll_no,class_id,school_id").eq("user_id", user.id).maybeSingle();
      if (studentError) throw studentError;
      if (!student) return null;
      const [classResult, schoolResult, attendanceResult] = await Promise.all([
        supabase.from("classes").select("name,section").eq("id", student.class_id).maybeSingle(),
        supabase.from("schools").select("name").eq("id", student.school_id).maybeSingle(),
        supabase.from("attendance_records").select("att_date,status").eq("student_id", student.id).order("att_date", { ascending: false }).limit(30),
      ]);
      const queryError = classResult.error ?? schoolResult.error ?? attendanceResult.error;
      if (queryError) throw queryError;
      return {
        name: student.full_name,
        roll: student.roll_no,
        className: classResult.data ? `${classResult.data.name} · ${classResult.data.section}` : "Class not assigned",
        schoolName: schoolResult.data?.name ?? activeSchool?.name ?? "School unavailable",
        attendance: (attendanceResult.data ?? []).map((entry) => ({ date: entry.att_date, status: entry.status })),
      };
    },
  });

  if (!ready) return <AppShell title="Student Portal"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (error) return <AppShell title="Student Portal"><Panel title="Account access unavailable">{error}</Panel></AppShell>;
  if (activeRole !== "student") return <AppShell title="Student Portal"><Panel title="Student account required">Select your student membership to view this portal.</Panel></AppShell>;
  const attendance = query.data?.attendance ?? [];
  const present = attendance.filter((row) => row.status === "present" || row.status === "late").length;
  return <AppShell title="Student Portal" subtitle={query.data ? `${query.data.schoolName} · ${query.data.className}` : "Your school workspace"}>
    {query.isPending ? <div className="surface-panel h-40 animate-pulse" /> : query.error ? <Panel title="Student records could not be loaded">{query.error.message}</Panel> : !query.data ? <Panel title="Student record not linked">Ask the school administrator to link your Auth account to your student record.</Panel> : <div className="space-y-6">
      <StatGrid items={[["Class", query.data.className, `Roll no. ${query.data.roll}`], ["Attendance recorded", String(attendance.length), "Most recent 30 days"], ["Present / late", String(present), "Most recent 30 days"], ["Absent", String(attendance.filter((row) => row.status === "absent").length), "Most recent 30 days"]]} />
      <Panel title={`Welcome, ${query.data.name}`} subtitle={`${query.data.schoolName} · ${query.data.className}`}>
        {attendance.length ? <ul className="divide-y divide-border">{attendance.slice(0, 10).map((row) => <li key={row.date} className="flex justify-between py-3 text-sm"><time>{new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN")}</time><span className="capitalize">{row.status}</span></li>)}</ul> : <p className="py-5 text-sm text-muted-foreground">No attendance records are available yet.</p>}
      </Panel>
      <p className="text-xs text-muted-foreground">Assignments, marks, timetable and fee records do not have live student tables configured yet.</p>
    </div>}
  </AppShell>;
}
