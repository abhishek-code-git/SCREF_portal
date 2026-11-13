import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session";

export type AppRole =
  | "central_super_admin"
  | "central_ops_admin"
  | "franchise_owner"
  | "school_principal"
  | "admissions_staff"
  | "teacher"
  | "accountant"
  | "transport_manager"
  | "parent"
  | "student";

export type School = {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  address: string;
  academic_year: string;
  status: string;
};

export type Membership = {
  id: string;
  school_id: string | null;
  role: AppRole;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  central_super_admin: "Central Super Admin",
  central_ops_admin: "Central Ops Admin",
  franchise_owner: "Franchise Owner",
  school_principal: "School Principal",
  admissions_staff: "Admissions Staff",
  teacher: "Teacher",
  accountant: "Accountant",
  transport_manager: "Transport Manager",
  parent: "Parent",
  student: "Student",
};

export const CENTRAL_ROLES: AppRole[] = ["central_super_admin", "central_ops_admin"];

export function isCentralRole(role: AppRole | undefined): boolean {
  return !!role && CENTRAL_ROLES.includes(role);
}

const ALL = "*";
/** Which pages each role may open. Display-only: data access is enforced by database rules. */
export const ROLE_PAGES: Record<AppRole, string[]> = {
  central_super_admin: [ALL],
  central_ops_admin: [ALL],
  franchise_owner: [ALL],
  school_principal: [ALL],
  teacher: ["/teacher", "/attendance", "/students", "/academics", "/communication", "/support", "/settings"],
  admissions_staff: ["/dashboard", "/admissions", "/students", "/parents", "/communication", "/support", "/settings"],
  accountant: ["/dashboard", "/finance", "/students", "/reports", "/support", "/settings"],
  transport_manager: ["/dashboard", "/transport", "/students", "/support", "/settings"],
  parent: ["/support", "/settings"],
  student: ["/student", "/support", "/settings"],
};

export function canOpen(role: AppRole | undefined, path: string): boolean {
  if (!role) return false;
  // Network administration is reserved for central roles, even though some
  // leadership roles have broad access to the existing school modules.
  if (path === "/admin" || path.startsWith("/admin/")) return isCentralRole(role);
  if (path === "/franchise" || path.startsWith("/franchise/")) {
    return role === "franchise_owner" || isCentralRole(role);
  }
  const pages = ROLE_PAGES[role];
  return pages.includes(ALL) || pages.includes(path);
}

export function homeFor(role: AppRole | undefined): "/teacher" | "/student" | "/dashboard" | "/franchise/dashboard" {
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  if (role === "franchise_owner") return "/franchise/dashboard";
  return "/dashboard";
}

export const LEADERSHIP: AppRole[] = ["central_super_admin", "central_ops_admin", "franchise_owner", "school_principal"];

/**
 * Loads the signed-in user's school memberships and schools straight from the
 * database. Roles are never read from browser-sent metadata — they come from
 * the server-enforced membership table only.
 */
export function useSchoolContext() {
  const { user, ready } = useSessionUser();
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const contextQuery = useQuery<{ memberships: Membership[]; schools: School[] }, Error>({
    queryKey: ["school-context", user?.id],
    enabled: ready && !!user,
    queryFn: async () => {
      if (!user) return { memberships: [], schools: [] };
      const membershipResult = await supabase.from("memberships").select("id,school_id,role").eq("user_id", user.id);
      if (membershipResult.error) throw membershipResult.error;
      const memberships = (membershipResult.data ?? []) as Membership[];
      const ids = [...new Set(memberships.map((membership) => membership.school_id).filter((id): id is string => !!id))];
      if (!ids.length) return { memberships, schools: [] };
      const schoolResult = await supabase.from("schools").select("*").in("id", ids);
      if (schoolResult.error) throw schoolResult.error;
      return { memberships, schools: (schoolResult.data ?? []) as School[] };
    },
  });
  const memberships = useMemo(() => contextQuery.data?.memberships ?? [], [contextQuery.data?.memberships]);
  const schools = contextQuery.data?.schools ?? [];
  const error = contextQuery.error?.message ?? null;
  const loaded = !user || !contextQuery.isPending;

  useEffect(() => {
    if (!user || !contextQuery.data) {
      if (!user) setSelectedMembershipId(null);
      return;
    }
    let storedMembershipId: string | null = null;
    try { storedMembershipId = window.localStorage.getItem(`active-membership:${user.id}`); } catch { /* storage may be unavailable */ }
    setSelectedMembershipId(memberships.length === 1 ? memberships[0]!.id : memberships.some((m) => m.id === storedMembershipId) ? storedMembershipId : null);
  }, [user, contextQuery.data, memberships]);

  const activeMembership = memberships.length === 1
    ? memberships[0]
    : memberships.find((m) => m.id === selectedMembershipId);
  const activeSchool = activeMembership?.school_id
    ? (schools.find((s) => s.id === activeMembership.school_id) ?? null)
    : null;
  const setActiveMembership = (membershipId: string) => {
    setSelectedMembershipId(membershipId);
    if (user) {
      try { window.localStorage.setItem(`active-membership:${user.id}`, membershipId); } catch { /* selection remains active for this page */ }
    }
  };

  return {
    user,
    ready: ready && loaded,
    error,
    memberships,
    schools,
    activeSchool,
    activeMembership,
    activeRole: activeMembership?.role,
    isCentralAdmin: memberships.some((m) => isCentralRole(m.role)),
    selectedMembershipId,
    setActiveMembership,
  };
}
