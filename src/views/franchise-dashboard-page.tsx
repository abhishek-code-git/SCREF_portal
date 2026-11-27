"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Rocket,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ReadOnlyBanner, StatGrid, Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useFranchiseScope } from "@/hooks/use-franchise";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type NeedsAttention = {
  kind: string;
  school_id: string;
  school_name: string;
  detail: string;
  since: string;
};
type Comparison = {
  school_id: string;
  name: string;
  code: string;
  status: string;
  student_count: number;
  teacher_count: number;
  has_principal: boolean;
  attendance_pct_30d: number | null;
  classes_without_attendance_today: number;
  open_enquiries: number;
  admitted_30d: number;
  last_activity_at: string | null;
};
type Activity = {
  id: string;
  actor_name: string;
  what: string;
  occurred_at: string;
  school_name: string;
};

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-IN");
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

export function FranchiseDashboard() {
  const router = useRouter();
  const ctx = useFranchiseScope();
  const { setActiveMembership, setActiveSchool, memberships } = useSchoolContext();
  const { franchiseId, scope, overview, readOnly, preview, loading, error } = ctx;

  const comparisonQuery = useQuery<Comparison[], Error>({
    queryKey: ["franchise-school-comparison", franchiseId],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_school_comparison", { _franchise_id: franchiseId });
      if (e) throw e;
      return (data ?? []) as Comparison[];
    },
  });

  const attentionQuery = useQuery<NeedsAttention[], Error>({
    queryKey: ["franchise-needs-attention", franchiseId],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_needs_attention", { _franchise_id: franchiseId });
      if (e) throw e;
      return (data ?? []) as NeedsAttention[];
    },
  });

  const activityQuery = useQuery<Activity[], Error>({
    queryKey: ["franchise-activity-feed", franchiseId],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_activity_feed", { _franchise_id: franchiseId, _limit: 15 });
      if (e) throw e;
      return (data ?? []) as Activity[];
    },
  });

  const comparison = useMemo(() => comparisonQuery.data ?? [], [comparisonQuery.data]);
  const attention = useMemo(() => attentionQuery.data ?? [], [attentionQuery.data]);
  const activity = useMemo(() => activityQuery.data ?? [], [activityQuery.data]);

  const [sortKey, setSortKey] = useState<"name" | "students" | "attendance">("name");
  const sorted = useMemo(() => {
    const rows = [...comparison];
    if (sortKey === "students") rows.sort((a, b) => b.student_count - a.student_count);
    else if (sortKey === "attendance") rows.sort((a, b) => (b.attendance_pct_30d ?? -1) - (a.attendance_pct_30d ?? -1));
    else rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [comparison, sortKey]);

  const openSchool = (schoolId: string) => {
    const m = memberships.find((membership) => membership.role === "franchise_owner" && membership.school_id === schoolId);
    if (m) setActiveMembership(m.id);
    setActiveSchool(schoolId);
    router.push("/principal");
  };

  const subtitle = scope
    ? `${scope.name}${scope.status !== "active" ? ` · ${scope.status}` : ""}${scope.master_status !== "active" ? ` · Master: ${scope.master_status}` : ""}`
    : "Franchise";

  if (!franchiseId && !loading) {
    return (
      <AppShell title="Franchise Dashboard" subtitle="No franchise selected">
        <div className="surface-panel flex flex-col items-center px-6 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-display text-base font-semibold">No franchise selected</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Your account does not have a franchise membership, or no franchise is selected. Contact your administrator.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Franchise Overview" subtitle={subtitle}>
      <div className="space-y-6">
        {readOnly && <ReadOnlyBanner visible />}
        {preview && (
          <div role="status" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-medium">
            Preview mode — you are viewing this franchise as {ctx.central ? "Central Admin" : "Master Owner"}. Data is read-only.
          </div>
        )}

        {error && (
          <div role="alert" className="surface-panel flex flex-wrap items-center gap-3 border-destructive/30 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Could not load franchise data</p>
              <p className="mt-1 break-words text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading franchise overview…</p>
        ) : overview && overview.school_count === 0 ? (
          <Panel className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-soft text-navy"><Rocket className="h-6 w-6" /></span>
            <p className="mt-4 font-display text-base font-semibold">Welcome to your franchise</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Get started by requesting your first school. It will appear here once submitted.</p>
            <Button className="mt-5" asChild><Link href="/franchise/schools">Request a school</Link></Button>
          </Panel>
        ) : overview ? (
          <StatGrid items={[
            ["Total Schools", n(overview.school_count), `${n(overview.active_school_count)} active · ${n(overview.pending_school_count)} pending`],
            ["Students", n(overview.student_count)],
            ["Teachers", n(overview.teacher_count), `${n(overview.principal_count)} principals`],
            ["Attendance Today", overview.attendance_today_count ? `${Math.round((overview.attendance_today_present / overview.attendance_today_count) * 100)}%` : "—", `${n(overview.attendance_today_present)} / ${n(overview.attendance_today_count)} marked`],
          ]} />
        ) : null}

        {attention.length > 0 && (
          <Panel title="Needs attention" subtitle={`${attention.length} item${attention.length === 1 ? "" : "s"} require your review`}>
            <ul className="divide-y divide-border">
              {attention.map((item, i) => (
                <li key={`${item.kind}-${item.school_id}-${i}`} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.school_name}</p>
                    <p className="mt-0.5 text-muted-foreground">{item.detail}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (item.kind === "school_declined" || item.kind === "school_pending_approval") router.push(`/franchise/schools/${item.school_id}`);
                    else openSchool(item.school_id);
                  }}>View</Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {!loading && sorted.length > 0 && (
          <Panel title="School comparison" action={
            <div className="flex gap-1">
              {(["name", "students", "attendance"] as const).map((key) => (
                <button key={key} onClick={() => setSortKey(key)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sortKey === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                  {key === "name" ? "Name" : key === "students" ? "Students" : "Attendance"}
                </button>
              ))}
            </div>
          }>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">School</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Students</th>
                    <th className="px-4 py-3 font-medium">Teachers</th>
                    <th className="px-4 py-3 font-medium">Att. 30d</th>
                    <th className="px-4 py-3 font-medium">Enquiries</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr key={row.school_id} className="border-t border-border transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={row.status === "active" ? "navy" : row.status === "rejected" ? "red" : "muted"}>{row.status}</Pill>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{n(row.student_count)}</td>
                      <td className="px-4 py-3 tabular-nums">{n(row.teacher_count)}{!row.has_principal && <span className="ml-1 text-xs text-destructive">No principal</span>}</td>
                      <td className="px-4 py-3 tabular-nums">{pct(row.attendance_pct_30d)}</td>
                      <td className="px-4 py-3 tabular-nums">{n(row.open_enquiries)}</td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => openSchool(row.school_id)}><ArrowUpRight className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Recent activity">
            {activityQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.slice(0, 10).map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.what}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.actor_name} · {item.school_name}</p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">{new Date(item.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Quick links">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Schools", to: "/franchise/schools", icon: Building2, desc: "Request & manage schools" },
                { label: "Team", to: "/franchise/team", icon: Users, desc: "Staff across all schools" },
                { label: "Attendance", to: "/franchise/reports", icon: ClipboardCheck, desc: "Cross-school reports" },
                { label: "Settings", to: "/franchise/settings", icon: GraduationCap, desc: "Franchise profile" },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} href={link.to} className="surface-panel flex items-center gap-3 rounded-lg p-4 transition-colors hover:bg-secondary">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
