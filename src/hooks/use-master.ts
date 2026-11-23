import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isCentralRole, useSchoolContext, type MasterFranchise } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

export type MasterOverview = {
  territory_count: number; franchise_count: number; active_franchise_count: number; pending_franchise_count: number;
  school_count: number; active_school_count: number; pending_school_count: number; student_count: number;
  teacher_count: number; principal_count: number; attendance_today_count: number; attendance_today_present: number;
  franchises_without_owner: number; schools_without_principal: number;
};
export type MasterFranchiseStat = {
  franchise_id: string; franchise_name: string; franchise_status: string; territory: string | null; created_at: string;
  school_count: number; active_school_count: number; student_count: number; teacher_count: number; owner_names: string | null;
  attendance_today_count: number; attendance_today_present: number;
};

export function useMasterScope() {
  const context = useSchoolContext();
  const central = context.memberships.some((membership) => isCentralRole(membership.role));
  const [requestedId, setRequestedId] = useState("");
  useEffect(() => { setRequestedId(new URLSearchParams(window.location.search).get("masterFranchiseId") ?? ""); }, []);
  const masterId = central ? requestedId : context.activeMasterFranchiseId ?? "";
  const availableQuery = useQuery<MasterFranchise[], Error>({
    queryKey: ["master-preview-options"], enabled: central,
    queryFn: async () => { const { data, error } = await supabase.from("master_franchises").select("id,name,status").order("name"); if (error) throw error; return data ?? []; },
  });
  const masterQuery = useQuery<MasterFranchise | null, Error>({
    queryKey: ["master-scope", masterId], enabled: !!masterId,
    queryFn: async () => { const { data, error } = await supabase.from("master_franchises").select("id,name,status").eq("id", masterId).maybeSingle(); if (error) throw error; return data; },
  });
  const territoriesQuery = useQuery<Array<{ id: string; territory: string }>, Error>({
    queryKey: ["master-territories", masterId], enabled: !!masterId,
    queryFn: async () => { const { data, error } = await supabase.from("master_franchise_territories").select("id,territory").eq("master_franchise_id", masterId).order("territory"); if (error) throw error; return data ?? []; },
  });
  const overviewQuery = useQuery<MasterOverview | null, Error>({
    queryKey: ["master-overview", masterId], enabled: !!masterId,
    queryFn: async () => { const { data, error } = await supabase.rpc("master_franchise_overview", { _master_franchise_id: masterId }); if (error) throw error; return (data?.[0] as MasterOverview | undefined) ?? null; },
  });
  const franchiseStatsQuery = useQuery<MasterFranchiseStat[], Error>({
    queryKey: ["master-franchise-stats", masterId], enabled: !!masterId,
    queryFn: async () => { const { data, error } = await supabase.rpc("master_franchise_franchise_stats", { _master_franchise_id: masterId }); if (error) throw error; return (data ?? []) as MasterFranchiseStat[]; },
  });
  const master = masterQuery.data ?? null;
  const isCentralPreview = central && !!masterId;
  const readOnly = isCentralPreview || (!!master && master.status !== "active");
  const error = context.error ?? availableQuery.error?.message ?? masterQuery.error?.message ?? territoriesQuery.error?.message ?? overviewQuery.error?.message ?? franchiseStatsQuery.error?.message ?? null;
  return {
    ...context, central, masterId, master, territories: territoriesQuery.data ?? [], overview: overviewQuery.data ?? null,
    franchiseStats: franchiseStatsQuery.data ?? [], availableMasters: availableQuery.data ?? [], isCentralPreview, readOnly,
    loading: !context.ready || (!!masterId && (masterQuery.isPending || territoriesQuery.isPending || overviewQuery.isPending || franchiseStatsQuery.isPending)) || (central && availableQuery.isPending),
    error,
  };
}

export function attendanceSummary(present: number, marked: number) {
  return marked ? `${present} / ${marked} (${Math.round((present / marked) * 100)}%)` : "No attendance marked";
}
