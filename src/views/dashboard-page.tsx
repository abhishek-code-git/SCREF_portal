"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { useWorkspace } from "@/hooks/use-workspace";
import { isCentralRole, useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type Counts = { students: number; classes: number };
type NetworkCounts = { schools: number; activeSchools: number; pendingSchools: number; students: number; classes: number; principals: number; teachers: number; franchiseOwners: number; masterFranchises: number; franchises: number };
type NetworkSetup = { masters: number; territories: number; franchises: number; linkedSchools: number; owners: number; pending: number; unassigned: number; suspended: number; ownerless: number };

export function Dashboard() {
  const { profile } = useWorkspace();
  const { activeSchool, activeRole } = useSchoolContext();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const networkQuery = useQuery<NetworkCounts, Error>({
    queryKey: ["central-network-summary"],
    enabled: isCentralRole(activeRole),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("central_network_dashboard");
      if (error) throw error;
      const summary = data?.[0];
      if (!summary) throw new Error("No central network summary was returned. Confirm this account has a central admin membership.");
      return {
        schools: summary.school_count,
        activeSchools: summary.active_school_count,
        pendingSchools: summary.pending_school_count,
        students: summary.student_count,
        classes: summary.class_count,
        principals: summary.principal_count,
        teachers: summary.teacher_count,
        franchiseOwners: summary.franchise_owner_count,
        masterFranchises: summary.master_franchise_count,
        franchises: summary.franchise_count,
      };
    },
  });
  const networkCounts = networkQuery.data;
  const setupQuery = useQuery<NetworkSetup, Error>({
    queryKey: ["central-network-setup"], enabled: isCentralRole(activeRole),
    queryFn: async () => {
      const [masters, territories, franchises, linkedSchools, owners, pendingMasters, pendingFranchises, onboardingSchools, unassignedSchools, suspendedSchools, allFranchises, ownerMemberships] = await Promise.all([
        supabase.from("master_franchises").select("id", { count: "exact", head: true }), supabase.from("master_franchise_territories").select("id", { count: "exact", head: true }), supabase.from("franchises").select("id", { count: "exact", head: true }), supabase.from("schools").select("id", { count: "exact", head: true }).not("franchise_id", "is", null), supabase.from("memberships").select("id", { count: "exact", head: true }).eq("role", "franchise_owner"),
        supabase.from("master_franchises").select("id", { count: "exact", head: true }).eq("status", "pending"), supabase.from("franchises").select("id", { count: "exact", head: true }).eq("status", "pending"), supabase.from("schools").select("id", { count: "exact", head: true }).in("status", ["onboarding", "pending"]), supabase.from("schools").select("id", { count: "exact", head: true }).is("franchise_id", null), supabase.from("schools").select("id", { count: "exact", head: true }).in("status", ["inactive", "suspended"]),
        supabase.from("franchises").select("id,master_franchise_id"), supabase.from("memberships").select("master_franchise_id,franchise_id").eq("role", "franchise_owner"),
      ]);
      const problem = [masters, territories, franchises, linkedSchools, owners, pendingMasters, pendingFranchises, onboardingSchools, unassignedSchools, suspendedSchools, allFranchises, ownerMemberships].find((item) => item.error)?.error;
      if (problem) throw problem;
      const ownedMasters = new Set((ownerMemberships.data ?? []).map((item) => item.master_franchise_id).filter(Boolean)); const ownedFranchises = new Set((ownerMemberships.data ?? []).map((item) => item.franchise_id).filter(Boolean));
      const ownerless = (allFranchises.data ?? []).filter((item) => !ownedFranchises.has(item.id) && !ownedMasters.has(item.master_franchise_id)).length;
      return { masters: masters.count ?? 0, territories: territories.count ?? 0, franchises: franchises.count ?? 0, linkedSchools: linkedSchools.count ?? 0, owners: owners.count ?? 0, pending: (pendingMasters.count ?? 0) + (pendingFranchises.count ?? 0) + (onboardingSchools.count ?? 0), unassigned: unassignedSchools.count ?? 0, suspended: suspendedSchools.count ?? 0, ownerless };
    },
  });

  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    setLoadError(null);
    if (!activeSchool) return () => { cancelled = true; };

    void Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", activeSchool.id),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", activeSchool.id),
    ]).then(([studentResult, classResult]) => {
      if (cancelled) return;
      const error = studentResult.error ?? classResult.error;
      if (error) setLoadError(error.message);
      else setCounts({ students: studentResult.count ?? 0, classes: classResult.count ?? 0 });
    }).catch((cause: unknown) => {
      if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Unable to load school totals.");
    });

    return () => { cancelled = true; };
  }, [activeSchool]);

  if (isCentralRole(activeRole)) {
    return (
      <AppShell title="Network Overview" subtitle="Central administration workspace">
        <div className="space-y-6">
          {networkQuery.error && <div role="alert" className="surface-panel p-5 text-sm text-destructive">Network records could not be loaded: {networkQuery.error.message}</div>}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Schools", networkCounts?.schools],
              ["Active schools", networkCounts?.activeSchools],
              ["Pending schools", networkCounts?.pendingSchools],
              ["Students", networkCounts?.students],
              ["Classes", networkCounts?.classes],
              ["Principals", networkCounts?.principals],
              ["Teachers", networkCounts?.teachers],
              ["Franchise owners", networkCounts?.franchiseOwners],
              ["Master franchises", networkCounts?.masterFranchises],
              ["Franchises", networkCounts?.franchises],
            ].map(([label, value]) => (
              <article key={label} className="surface-panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value === undefined ? "—" : value.toLocaleString("en-IN")}</p>
              </article>
            ))}
          </section>
          {!networkQuery.error && !networkQuery.isPending && <section className="grid gap-5 xl:grid-cols-2"><div className="surface-panel p-5"><h2 className="font-display font-semibold">Getting started</h2><ol className="mt-3 space-y-2 text-sm text-muted-foreground">{[["Create a master franchise", setupQuery.data?.masters, "/admin/master-franchises"], ["Add territories", setupQuery.data?.territories, "/admin/master-franchises"], ["Create a franchise", setupQuery.data?.franchises, "/admin/franchises"], ["Create or link a school", setupQuery.data?.linkedSchools, "/admin/schools"], ["Invite franchise owners", setupQuery.data?.owners, "/admin/users"]].map(([label, count, href], index) => <li key={String(label)} className="flex items-center justify-between gap-3"><span>{index + 1}. {String(label)} {count ? "✓" : ""}</span>{!count && <Link className="text-primary hover:underline" href={String(href)}>Open</Link>}</li>)}</ol></div><div className="surface-panel p-5"><h2 className="font-display font-semibold">Needs attention</h2>{setupQuery.isPending ? <p className="mt-3 text-sm text-muted-foreground">Checking network records…</p> : <div className="mt-3 space-y-2 text-sm text-muted-foreground">{[[setupQuery.data?.pending, "Pending approvals", "/admin/onboarding"], [setupQuery.data?.unassigned, "Schools without a franchise", "/admin/schools"], [setupQuery.data?.ownerless, "Networks without an owner", "/admin/franchises"], [setupQuery.data?.suspended, "Inactive schools", "/admin/schools"]].filter(([count]) => !!count).map(([count, label, href]) => <p key={String(label)}><Link className="text-primary hover:underline" href={String(href)}>{count} {String(label)}</Link></p>)}{!setupQuery.data?.pending && !setupQuery.data?.unassigned && !setupQuery.data?.ownerless && !setupQuery.data?.suspended && <p>No actions need attention.</p>}</div>}</div></section>}
          <section className="surface-panel space-y-4 p-5"><div><h2 className="font-display font-semibold">Network management</h2><p className="mt-1 text-sm text-muted-foreground">Manage database-backed master franchise and franchise records, owners, territories, school links, and access status.</p></div><div className="flex flex-wrap gap-3"><Link href="/admin/master-franchises" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Manage master franchises</Link><Link href="/admin/franchises" className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium">Manage franchises</Link><Link href="/admin/schools" className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium">Manage schools</Link></div></section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Welcome, ${profile?.full_name ?? ""}`}
      subtitle={activeSchool ? `${activeSchool.name} · ${activeSchool.academic_year}` : "Your central workspace"}
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Students", counts ? counts.students.toLocaleString("en-IN") : "—"],
            ["Classes", counts ? counts.classes.toLocaleString("en-IN") : "—"],
            ["Attendance", "Not connected"],
            ["Fees", "Not connected"],
          ].map(([label, value]) => (
            <div key={label} className="surface-panel p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <p className="mt-3 font-display text-2xl font-semibold text-foreground tabular-nums">{value}</p>
            </div>
          ))}
        </section>
        {loadError ? (
          <div role="alert" className="surface-panel p-5 text-sm text-destructive">School totals could not be loaded: {loadError}. Refresh the page or contact your administrator if this continues.</div>
        ) : !activeSchool ? (
          <div className="surface-panel p-5 text-sm text-muted-foreground">Select a school workspace to see its data.</div>
        ) : counts ? (
          <div className="surface-panel p-5"><h2 className="font-display text-lg font-semibold">Workspace overview</h2><p className="mt-2 text-sm text-muted-foreground">These totals are read from your selected school. Attendance and fee summaries will appear when those records are connected.</p></div>
        ) : (
          <div className="surface-panel p-5 text-sm text-muted-foreground">Loading school totals…</div>
        )}
      </div>
    </AppShell>
  );
}
