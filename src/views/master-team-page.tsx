"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useMasterScope } from "@/hooks/use-master";
import { supabase } from "@/integrations/supabase/client";

type MembershipRow = { id: string; user_id: string; role: "franchise_owner" | "school_principal"; school_id: string | null; franchise_id: string | null };
type TeamPerson = MembershipRow & { name: string; phone: string; organization: string; active: boolean };

export function MasterTeamPage() {
  const scope = useMasterScope(); const queryClient = useQueryClient();
  const teamQuery = useQuery<TeamPerson[], Error>({
    queryKey: ["master-team", scope.masterId, scope.franchiseStats.map((item) => item.franchise_id)], enabled: !!scope.masterId && !scope.loading,
    queryFn: async () => {
      const franchiseIds = scope.franchiseStats.map((item) => item.franchise_id);
      if (franchiseIds.length === 0) return [];
      const [ownerMemberships, schoolLinks] = await Promise.all([
        supabase.from("memberships").select("id,user_id,role,school_id,franchise_id").in("franchise_id", franchiseIds).eq("role", "franchise_owner"),
        supabase.from("schools").select("id,franchise_id,name,status").in("franchise_id", franchiseIds),
      ]);
      const issue = ownerMemberships.error ?? schoolLinks.error; if (issue) throw issue;
      const schools = schoolLinks.data ?? []; const schoolIds = schools.map((item) => item.id);
      const principalMemberships = schoolIds.length ? await supabase.from("memberships").select("id,user_id,role,school_id,franchise_id").in("school_id", schoolIds).eq("role", "school_principal") : { data: [], error: null };
      if (principalMemberships.error) throw principalMemberships.error;
      const memberships = [...(ownerMemberships.data ?? []), ...(principalMemberships.data ?? [])] as MembershipRow[];
      const userIds = [...new Set(memberships.map((item) => item.user_id))];
      const profileResult = userIds.length ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", userIds) : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profileMap = new Map((profileResult.data ?? []).map((item) => [item.user_id, item]));
      const schoolMap = new Map(schools.map((item) => [item.id, item]));
      return memberships.map((item) => {
        const profile = profileMap.get(item.user_id);
        const school = item.school_id ? schoolMap.get(item.school_id) : null;
        const franchise = scope.franchiseStats.find((record) => record.franchise_id === (item.franchise_id ?? school?.franchise_id));
        return { ...item, name: profile?.full_name || "Name not provided", phone: profile?.phone || "Phone not provided", organization: item.role === "school_principal" ? school?.name ?? "School" : franchise?.franchise_name ?? "Franchise", active: item.role === "school_principal" ? school?.status === "active" : franchise?.franchise_status === "active" };
      });
    },
  });
  const remove = async (person: TeamPerson) => { if (!window.confirm(`Remove ${person.name}'s ${person.role === "school_principal" ? "principal" : "franchise owner"} access?`)) return; const { error } = await supabase.from("memberships").delete().eq("id", person.id); if (error) window.alert(error.message); else await queryClient.invalidateQueries({ queryKey: ["master-team", scope.masterId] }); };
  const people = teamQuery.data ?? [];
  return <AppShell title="Team" subtitle="Franchise owners and principals assigned to your network"><div className="space-y-5">
    {scope.isCentralPreview && <div role="status" className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">Previewing {scope.master?.name ?? "master franchise"} as Central Admin. This view is read-only.</div>}
    {!scope.isCentralPreview && scope.master && scope.master.status !== "active" && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">Read only: your master franchise is {scope.master.status}.</div>}
    {scope.error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{scope.error}</div>}{teamQuery.error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">Team records could not be loaded: {teamQuery.error.message}</div>}
    {scope.loading || teamQuery.isPending ? <section className="surface-panel p-5 text-sm text-muted-foreground">Loading network team…</section> : !scope.masterId || !scope.master ? <section className="surface-panel p-5 text-sm text-muted-foreground">No authorized master network is selected.</section> : <>
      {(["franchise_owner", "school_principal"] as const).map((role) => { const rows = people.filter((person) => person.role === role); return <section className="surface-panel overflow-hidden" key={role}><div className="border-b p-5"><h2 className="font-display font-semibold">{role === "franchise_owner" ? "Franchise owners" : "Principals"}</h2></div>{rows.length ? <div className="divide-y">{rows.map((person) => <article key={person.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><p className="font-medium">{person.name}</p><p className="text-xs text-muted-foreground">{person.organization} · {person.phone}</p></div>{!scope.readOnly && person.active && <Button size="sm" variant="outline" onClick={() => void remove(person)}>Remove access</Button>}</article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No {role === "franchise_owner" ? "franchise owners" : "principals"} assigned in this network.</p>}</section>; })}
    </>}
  </div></AppShell>;
}
