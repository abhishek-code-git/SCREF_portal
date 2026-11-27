"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isCentralRole, useSchoolContext, type OwnedFranchise } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

export type FranchiseScope = { id: string; name: string; status: string; master_status: string };
export type FranchiseOverview = {
  school_count: number;
  active_school_count: number;
  pending_school_count: number;
  student_count: number;
  teacher_count: number;
  principal_count: number;
  attendance_today_count: number;
  attendance_today_present: number;
  schools_without_principal: number;
};
export type FranchiseSchool = {
  school_id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  address: string;
  academic_year: string;
  status: string;
  decline_reason: string;
  created_at: string;
  phone: string;
  email: string;
  principal_name: string;
};

export function useFranchiseScope() {
  const context = useSchoolContext();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const requestedId = params.get("franchiseId") ?? "";
  const central = context.memberships.some((membership) => isCentralRole(membership.role));
  const masterOwner = context.memberships.some(
    (membership) => membership.role === "franchise_owner" && !!membership.master_franchise_id,
  );
  const previewMode = central || (masterOwner && !context.franchiseMemberships.length) || (masterOwner && !!requestedId);
  const franchiseId = previewMode ? requestedId : (context.activeFranchiseId ?? context.franchiseMemberships[0]?.franchise_id ?? "");
  const preview = previewMode && !!franchiseId;

  const scopeQuery = useQuery<FranchiseScope | null, Error>({
    queryKey: ["franchise-dashboard-scope", franchiseId, context.user?.id],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("franchise_dashboard_scope", { _franchise_id: franchiseId });
      if (error) throw error;
      return (data?.[0] as FranchiseScope | undefined) ?? null;
    },
  });

  const overviewQuery = useQuery<FranchiseOverview | null, Error>({
    queryKey: ["franchise-overview", franchiseId, context.user?.id],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("franchise_overview", { _franchise_id: franchiseId });
      if (error) throw error;
      return (data?.[0] as FranchiseOverview | undefined) ?? null;
    },
  });

  const schoolsQuery = useQuery<FranchiseSchool[], Error>({
    queryKey: ["franchise-schools", franchiseId, context.user?.id],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("franchise_schools_list", { _franchise_id: franchiseId });
      if (error) throw error;
      return (data ?? []) as FranchiseSchool[];
    },
  });

  const defaultYearQuery = useQuery<string, Error>({
    queryKey: ["franchise-default-academic-year", franchiseId],
    enabled: !!franchiseId && !preview && scopeQuery.data?.status === "active" && scopeQuery.data?.master_status === "active",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_settings")
        .select("setting_value")
        .eq("setting_key", "default_academic_year")
        .maybeSingle();
      if (error) throw error;
      return typeof data?.setting_value === "string" && data.setting_value.trim() ? data.setting_value : academicYear();
    },
  });

  const scope = scopeQuery.data ?? null;
  const ownedMeta: OwnedFranchise | null =
    context.myFranchises.find((f) => f.id === franchiseId) ?? null;
  const readOnly = preview || !scope || scope.status !== "active" || scope.master_status !== "active";

  return {
    ...context,
    central,
    masterOwner,
    preview,
    franchiseId,
    scope,
    ownedMeta,
    overview: overviewQuery.data ?? null,
    schools: schoolsQuery.data ?? [],
    defaultAcademicYear: defaultYearQuery.data ?? academicYear(),
    readOnly,
    loading:
      !context.ready ||
      (!!franchiseId && (scopeQuery.isPending || overviewQuery.isPending || schoolsQuery.isPending)),
    error:
      context.error ??
      scopeQuery.error?.message ??
      overviewQuery.error?.message ??
      schoolsQuery.error?.message ??
      defaultYearQuery.error?.message ??
      null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-franchises", context.user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["school-context", context.user?.id] });
      await Promise.all([
        scopeQuery.refetch(),
        overviewQuery.refetch(),
        schoolsQuery.refetch(),
        defaultYearQuery.refetch(),
      ]);
    },
  };
}

function academicYear() {
  const year = new Date().getFullYear();
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}
