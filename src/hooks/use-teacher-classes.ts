"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolContext } from "@/hooks/use-school";
import type { ClassRow } from "@/lib/school-data";

export type TeacherAssignment = {
  id: string;
  school_id: string;
  class_id: string;
  teacher_user_id: string;
  subject_name: string;
  is_active: boolean;
};

export type TeacherClassInfo = ClassRow & {
  role: "Class teacher" | "Subject teacher";
  subjects: string[];
  student_count: number;
};

/**
 * Loads every class the signed-in teacher has access to — either as class_teacher
 * on the classes table or through class_teacher_assignments. Returns enriched
 * class objects with role and student count.
 */
export function useTeacherClasses() {
  const { user, activeSchool, activeRole, ready } = useSchoolContext();
  const [classes, setClasses] = useState<TeacherClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeSchool || !user || activeRole !== "teacher") {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [assignResult, classResult, studentResult] = await Promise.all([
      supabase
        .from("class_teacher_assignments")
        .select("id,school_id,class_id,teacher_user_id,subject_name,is_active")
        .eq("school_id", activeSchool.id)
        .eq("teacher_user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("classes")
        .select("id,name,section,class_teacher")
        .eq("school_id", activeSchool.id)
        .order("name")
        .order("section"),
      supabase
        .from("students")
        .select("id,class_id")
        .eq("school_id", activeSchool.id),
    ]);

    if (assignResult.error || classResult.error) {
      setError((assignResult.error ?? classResult.error)!.message);
      setClasses([]);
      setLoading(false);
      return;
    }

    const assignments = (assignResult.data ?? []) as TeacherAssignment[];
    const allClasses = (classResult.data ?? []) as ClassRow[];
    const students = studentResult.data ?? [];

    // Build a map of class IDs this teacher is assigned to
    const assignedClassIds = new Set(assignments.map((a) => a.class_id));

    // Also include classes where teacher is the class_teacher directly
    allClasses.forEach((cls) => {
      if (cls.class_teacher === user.id) assignedClassIds.add(cls.id);
    });

    const result: TeacherClassInfo[] = [];
    for (const classId of assignedClassIds) {
      const cls = allClasses.find((c) => c.id === classId);
      if (!cls) continue;
      const isClassTeacher = cls.class_teacher === user.id;
      const classAssignments = assignments.filter((a) => a.class_id === classId);
      const subjects = classAssignments.map((a) => a.subject_name).filter((s) => s !== "Class teacher");
      const count = students.filter((s) => s.class_id === classId).length;
      result.push({
        ...cls,
        role: isClassTeacher ? "Class teacher" : "Subject teacher",
        subjects,
        student_count: count,
      });
    }
    result.sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section));
    setClasses(result);
    setLoading(false);
  }, [activeSchool, activeRole, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { classes, loading, error, reload: load, user, activeSchool, activeRole, ready };
}
