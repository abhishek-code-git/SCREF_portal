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
  franchise_id: string | null;
  phone: string;
  email: string;
  principal_name: string;
  logo_url: string;
};

export type Membership = {
  id: string;
  school_id: string | null;
  master_franchise_id: string | null;
  franchise_id: string | null;
  role: AppRole;
};

export type MasterFranchise = { id: string; name: string; status: string };
export type OwnedFranchise = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  master_name: string;
  master_status: string;
  territory: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  owner_name: string;
};

export function franchiseOwnerScope(membership: Membership): "master" | "franchise" | "school" | null {
  if (membership.role !== "franchise_owner") return null;
  if (membership.master_franchise_id) return "master";
  if (membership.franchise_id) return "franchise";
  if (membership.school_id) return "school";
  return null;
}

export function membershipRoleLabel(membership: Membership | undefined): string | undefined {
  if (!membership) return undefined;
  return membership.role === "franchise_owner" && franchiseOwnerScope(membership) === "master"
    ? "Master Franchise Owner"
    : ROLE_LABELS[membership.role];
}

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
  school_principal: [
    "/principal",
    "/classes",
    "/students",
    "/students/promote",
    "/staff",
    "/attendance",
    "/exams",
    "/notices",
    "/admissions",
    "/reports",
    "/settings",
    "/support",
  ],
  teacher: ["/teacher", "/teacher/classes", "/teacher/timetable", "/teacher/attendance", "/teacher/homework", "/teacher/marks", "/teacher/notices", "/support", "/settings"],
  admissions_staff: ["/dashboard", "/admissions", "/students", "/support", "/settings"],
  accountant: ["/dashboard", "/finance", "/students", "/reports", "/support", "/settings"],
  transport_manager: ["/dashboard", "/transport", "/students", "/support", "/settings"],
  parent: ["/support", "/settings"],
  student: ["/student", "/support", "/settings"],
};

export function canOpen(role: AppRole | undefined, path: string, membership?: Membership): boolean {
  if (!role) return false;
  if (path === "/master" || path.startsWith("/master/")) {
    return isCentralRole(role) || (role === "franchise_owner" && franchiseOwnerScope(membership ?? { id: "", school_id: null, master_franchise_id: null, franchise_id: null, role }) === "master");
  }
  // Network administration is reserved for central roles, even though some
  // leadership roles have broad access to the existing school modules.
  if (path === "/admin" || path.startsWith("/admin/")) return isCentralRole(role);
  if (path === "/franchise" || path.startsWith("/franchise/")) {
    return role === "franchise_owner" || isCentralRole(role);
  }
  const pages = ROLE_PAGES[role];
  if (pages.includes(ALL) || pages.includes(path)) return true;
  if (pages.includes("/students") && path.startsWith("/students/")) return true;
  return false;
}

export function homeFor(role: AppRole | undefined, membership?: Membership): "/principal" | "/teacher" | "/student" | "/dashboard" | "/franchise/dashboard" | "/master/dashboard" {
  if (role === "school_principal") return "/principal";
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  if (role === "franchise_owner") return franchiseOwnerScope(membership ?? { id: "", school_id: null, master_franchise_id: null, franchise_id: null, role }) === "master" ? "/master/dashboard" : "/franchise/dashboard";
  return "/dashboard";
}

export function useSchoolWritable(schoolId: string | undefined) {
  const { user } = useSessionUser();
  const query = useQuery<boolean, Error>({
    queryKey: ["school-writable", schoolId, user?.id],
    enabled: !!schoolId && !!user,
    queryFn: async () => {
      if (!schoolId) return false;
      const { data, error } = await supabase.rpc("school_is_writable", { _school_id: schoolId });
      if (error) throw error;
      return !!data;
    },
  });
  return {
    isWritable: query.data ?? false,
    writableLoading: query.isPending,
    writableError: query.error?.message ?? null,
  };
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
  const [activeMasterFranchiseId, setActiveMasterFranchiseId] = useState<string | null>(null);
  const [activeFranchiseId, setActiveFranchiseId] = useState<string | null>(null);
  const [activeWorkspaceSchoolId, setActiveWorkspaceSchoolId] = useState<string | null>(null);
  const [selectionReady, setSelectionReady] = useState(false);
  const contextQuery = useQuery<{ memberships: Membership[]; schools: School[] }, Error>({
    queryKey: ["school-context", user?.id],
    enabled: ready && !!user,
    queryFn: async () => {
      if (!user) return { memberships: [], schools: [] };
      const membershipResult = await supabase.from("memberships").select("id,school_id,master_franchise_id,franchise_id,role").eq("user_id", user.id);
      if (membershipResult.error) throw membershipResult.error;
      const memberships = (membershipResult.data ?? []) as Membership[];
      const ids = [...new Set(memberships.map((membership) => membership.school_id).filter((id): id is string => !!id))];
      const franchiseIds = [...new Set(memberships.filter((membership) => membership.role === "franchise_owner" && membership.franchise_id).map((membership) => membership.franchise_id!))];
      const [directSchools, franchiseSchools] = await Promise.all([
        ids.length ? supabase.from("schools").select("*").in("id", ids) : Promise.resolve({ data: [], error: null }),
        franchiseIds.length ? supabase.from("schools").select("*").in("franchise_id", franchiseIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const issue = directSchools.error ?? franchiseSchools.error;
      if (issue) throw issue;
      const schools = [...(directSchools.data ?? []), ...(franchiseSchools.data ?? [])] as School[];
      return { memberships, schools: [...new Map(schools.map((school) => [school.id, school])).values()] };
    },
  });
  const memberships = useMemo(() => contextQuery.data?.memberships ?? [], [contextQuery.data?.memberships]);
  const masterMemberships = useMemo(() => memberships.filter((membership) => franchiseOwnerScope(membership) === "master"), [memberships]);
  const franchiseMemberships = useMemo(() => memberships.filter((membership) => franchiseOwnerScope(membership) === "franchise"), [memberships]);
  const masterIds = useMemo(() => [...new Set(masterMemberships.map((membership) => membership.master_franchise_id).filter((id): id is string => !!id))], [masterMemberships]);
  const masterQuery = useQuery<MasterFranchise[], Error>({
    queryKey: ["master-franchises-for-user", user?.id, masterIds],
    enabled: ready && !!user && masterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("master_franchises").select("id,name,status").in("id", masterIds);
      if (error) throw error;
      return (data ?? []) as MasterFranchise[];
    },
  });
  const myFranchisesQuery = useQuery<OwnedFranchise[], Error>({
    queryKey: ["my-franchises", user?.id],
    enabled: ready && !!user && franchiseMemberships.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_franchises");
      if (error) throw error;
      return (data ?? []) as OwnedFranchise[];
    },
  });
  const myFranchises = useMemo(() => myFranchisesQuery.data ?? [], [myFranchisesQuery.data]);
  const schools = useMemo(() => contextQuery.data?.schools ?? [], [contextQuery.data?.schools]);
  const error = contextQuery.error?.message ?? masterQuery.error?.message ?? myFranchisesQuery.error?.message ?? null;
  const loaded =
    !user ||
    (!contextQuery.isPending &&
      (masterIds.length === 0 || !masterQuery.isPending) &&
      (franchiseMemberships.length === 0 || !myFranchisesQuery.isPending));

  useEffect(() => {
    if (!user) {
      setSelectedMembershipId(null);
      setActiveMasterFranchiseId(null);
      setActiveFranchiseId(null);
      setActiveWorkspaceSchoolId(null);
      setSelectionReady(true);
      return;
    }
    if (!contextQuery.data) {
      setSelectionReady(false);
      return;
    }
    let storedMembershipId: string | null = null;
    try { storedMembershipId = window.localStorage.getItem(`active-membership:${user.id}`); } catch { /* storage may be unavailable */ }
    setSelectedMembershipId(memberships.length === 1 ? memberships[0]!.id : memberships.some((m) => m.id === storedMembershipId) ? storedMembershipId : null);
    let savedSchoolId: string | null = null;
    try { savedSchoolId = window.localStorage.getItem(`active-workspace-school:${user.id}`); } catch { /* storage may be unavailable */ }
    setActiveWorkspaceSchoolId(schools.some((school) => school.id === savedSchoolId) ? savedSchoolId : schools[0]?.id ?? null);
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(`active-master-franchise:${user.id}`); } catch { /* storage may be unavailable */ }
    const next = masterIds.includes(saved ?? "") ? saved : masterIds[0] ?? null;
    setActiveMasterFranchiseId(next);
    let savedFranchise: string | null = null;
    try { savedFranchise = window.localStorage.getItem(`active-franchise:${user.id}`); } catch { /* storage may be unavailable */ }
    const franchiseIds = myFranchises.map((f) => f.id);
    const nextFranchise = franchiseIds.includes(savedFranchise ?? "") ? savedFranchise : franchiseIds[0] ?? franchiseMemberships[0]?.franchise_id ?? null;
    setActiveFranchiseId(nextFranchise);
    setSelectionReady(true);
  }, [user, contextQuery.data, memberships, masterIds, schools, myFranchises, franchiseMemberships]);

  const activeMembership = memberships.length === 1
    ? memberships[0]
    : memberships.find((m) => m.id === selectedMembershipId);
  const activeSchool = activeMembership?.school_id
    ? (schools.find((s) => s.id === activeMembership.school_id) ?? null)
    : activeWorkspaceSchoolId
    ? (schools.find((school) => school.id === activeWorkspaceSchoolId) ?? null)
    : null;
  const setActiveSchool = (schoolId: string) => {
    if (!schools.some((school) => school.id === schoolId)) return;
    setActiveWorkspaceSchoolId(schoolId);
    const matchingMembership = memberships.find((m) => m.school_id === schoolId);
    if (matchingMembership) {
      setSelectedMembershipId(matchingMembership.id);
      if (user) {
        try { window.localStorage.setItem(`active-membership:${user.id}`, matchingMembership.id); } catch { /* storage may be unavailable */ }
      }
    }
    if (user) {
      try { window.localStorage.setItem(`active-workspace-school:${user.id}`, schoolId); } catch { /* selection remains active for this page */ }
    }
  };
  const setActiveMembership = (membershipId: string) => {
    setSelectedMembershipId(membershipId);
    if (user) {
      try { window.localStorage.setItem(`active-membership:${user.id}`, membershipId); } catch { /* selection remains active for this page */ }
    }
  };
  const selectMasterFranchise = (masterId: string) => {
    if (!masterIds.includes(masterId)) return;
    setActiveMasterFranchiseId(masterId);
    if (user) {
      try { window.localStorage.setItem(`active-master-franchise:${user.id}`, masterId); } catch { /* selection remains active for this page */ }
    }
  };
  const selectFranchise = (franchiseId: string) => {
    if (!myFranchises.some((f) => f.id === franchiseId) && !franchiseMemberships.some((m) => m.franchise_id === franchiseId)) return;
    setActiveFranchiseId(franchiseId);
    const matchingMembership = franchiseMemberships.find((m) => m.franchise_id === franchiseId);
    if (matchingMembership) {
      setSelectedMembershipId(matchingMembership.id);
      if (user) {
        try { window.localStorage.setItem(`active-membership:${user.id}`, matchingMembership.id); } catch { /* storage may be unavailable */ }
      }
    }
    if (user) {
      try { window.localStorage.setItem(`active-franchise:${user.id}`, franchiseId); } catch { /* selection remains active for this page */ }
    }
  };
  const activeMasterFranchise = masterQuery.data?.find((master) => master.id === activeMasterFranchiseId) ?? null;
  const activeFranchise = myFranchises.find((f) => f.id === activeFranchiseId) ?? null;

  return {
    user,
    ready: ready && loaded && selectionReady,
    error,
    memberships,
    masterMemberships,
    franchiseMemberships,
    masterFranchises: masterQuery.data ?? [],
    activeMasterFranchise,
    activeMasterFranchiseId,
    setActiveMasterFranchise: selectMasterFranchise,
    myFranchises,
    activeFranchise,
    activeFranchiseId,
    setActiveFranchise: selectFranchise,
    schools,
    workspaceSchools: schools,
    setActiveSchool,
    activeSchool,
    activeMembership,
    activeRole: activeMembership?.role,
    isCentralAdmin: memberships.some((m) => isCentralRole(m.role)),
    selectedMembershipId,
    setActiveMembership,
  };
}
