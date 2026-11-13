import { supabase } from "@/integrations/supabase/client";

export type ClassRow = { id: string; name: string; section: string; class_teacher: string | null };
export type StudentRow = { id: string; full_name: string; roll_no: number; class_id: string };
export type AttStatus = "present" | "absent" | "late" | "leave";

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const classLabel = (c: Pick<ClassRow, "name" | "section">) => `${c.name}-${c.section}`;

export async function loadClasses(schoolId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section, class_teacher")
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function loadStudents(classId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, roll_no, class_id")
    .eq("class_id", classId)
    .order("roll_no");
  if (error) throw error;
  return (data ?? []) as StudentRow[];
}

/** Per-class attendance summary for one day across the school. */
export async function loadClassSummary(schoolId: string, date: string) {
  const [cls, studs, att] = await Promise.all([
    loadClasses(schoolId),
    supabase.from("students").select("class_id").eq("school_id", schoolId),
    supabase.from("attendance_records").select("class_id, status").eq("school_id", schoolId).eq("att_date", date),
  ]);
  return cls.map((c) => {
    const total = (studs.data ?? []).filter((s) => s.class_id === c.id).length;
    const recs = (att.data ?? []).filter((a) => a.class_id === c.id);
    const count = (s: AttStatus) => recs.filter((r) => r.status === s).length;
    return {
      cls: c,
      total,
      marked: recs.length,
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      leave: count("leave"),
    };
  });
}
