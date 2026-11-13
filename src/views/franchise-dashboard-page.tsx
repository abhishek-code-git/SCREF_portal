"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowUpRight, Building2, ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type SchoolMetric = {
  school_id: string; school_code: string; school_name: string; city: string; state: string;
  address: string; academic_year: string; school_status: string; school_created_at: string;
  student_count: number; teacher_count: number; principal_count: number; class_count: number;
  principal_names: string | null;
  attendance_today_count: number; attendance_today_present: number;
  network_teacher_count: number; network_principal_count: number;
};

const count = (value: number) => value.toLocaleString("en-IN");
const statusLabel = (value: string) => {
  const status = value.toLowerCase();
  if (["onboarding", "pending"].includes(status)) return "Pending";
  if (["suspended", "inactive", "disabled", "archived"].includes(status)) return "Inactive";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export function FranchiseDashboard() {
  const router = useRouter();
  const { memberships, setActiveMembership } = useSchoolContext();
  const [schools, setSchools] = useState<SchoolMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteSchool, setInviteSchool] = useState<SchoolMetric | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const assignedMemberships = useMemo(
    () => memberships.filter((membership) => membership.role === "franchise_owner" && membership.school_id),
    [memberships],
  );
  const schoolIds = useMemo(
    () => [...new Set(assignedMemberships.map((membership) => membership.school_id!))],
    [assignedMemberships],
  );
  const membershipBySchool = useMemo(
    () => new Map(assignedMemberships.map((membership) => [membership.school_id!, membership.id])),
    [assignedMemberships],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.rpc("franchise_network_dashboard");
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setSchools([]);
        } else {
          setSchools((data ?? []) as SchoolMetric[]);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Unable to load your assigned school network.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadToken]);

  const totalStudents = useMemo(
    () => schools.reduce((total, school) => total + school.student_count, 0),
    [schools],
  );
  const totalTeachers = schools[0]?.network_teacher_count ?? 0;
  const totalPrincipals = schools[0]?.network_principal_count ?? 0;
  const active = schools.filter((school) => school.school_status.toLowerCase() === "active").length;
  const pending = schools.filter((school) => ["onboarding", "pending"].includes(school.school_status.toLowerCase())).length;
  const inactive = schools.filter((school) => ["suspended", "inactive", "disabled", "archived"].includes(school.school_status.toLowerCase())).length;

  const openSchool = (schoolId: string) => {
    const membershipId = membershipBySchool.get(schoolId);
    if (!membershipId) return;
    setActiveMembership(membershipId);
    router.push("/dashboard");
  };

  const createPrincipalInvite = async () => {
    if (!inviteSchool || !inviteEmail.trim()) return;
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setInviteLoading(true);
    try {
      const { error: inviteError } = await supabase.from("staff_invites").insert({
        school_id: inviteSchool.school_id,
        email: normalizedEmail,
        role: "school_principal",
      });
      if (inviteError) {
        toast.error("Could not prepare principal access: " + inviteError.message);
        return;
      }
      toast.success("Principal signup access was prepared for " + inviteSchool.school_name);
      setInviteSchool(null);
      setInviteEmail("");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to save this principal invite.");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <AppShell title="Franchise Dashboard" subtitle="Your database-assigned school network">
      <div className="space-y-6">
        {error && <div role="alert" className="surface-panel flex flex-wrap items-center gap-3 border-destructive/30 p-4 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p className="font-medium">Network data could not be loaded</p><p className="mt-1 break-words text-muted-foreground">{error}</p></div><Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>Retry</Button></div>}
        {!loading && !error && schoolIds.length === 0 && <section className="surface-panel space-y-3 p-6"><h2 className="font-display text-lg font-semibold">No schools are assigned to this account</h2><p className="text-sm text-muted-foreground">Ask a Main Admin to assign the schools you are authorized to manage. This dashboard does not include unassigned schools.</p></section>}

        <section aria-label="Assigned network metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Assigned schools", value: loading || error ? "—" : count(schools.length), icon: Building2 },
            { label: "Active schools", value: loading || error ? "—" : count(active), icon: ClipboardCheck },
            { label: "Pending schools", value: loading || error ? "—" : count(pending), icon: AlertCircle },
            { label: "Students", value: loading || error ? "—" : count(totalStudents), icon: GraduationCap },
            { label: "Teachers · Principals", value: loading || error ? "—" : count(totalTeachers) + " · " + count(totalPrincipals), icon: Users },
          ].map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="surface-panel p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-3 font-display text-2xl font-semibold tabular-nums">{metric.value}</p></article>; })}
        </section>

        <section id="schools" className="surface-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4"><h2 className="font-display font-semibold">Authorized schools</h2><p className="mt-1 text-xs text-muted-foreground">Access comes from your franchise owner school memberships.</p></div>
          {loading ? <p className="p-5 text-sm text-muted-foreground">Loading assigned school records…</p> : error ? null : schools.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No authorized school records were returned.</p> : (
            <div className="divide-y divide-border">{schools.map((school) => {
              const attendance = school.attendance_today_count ? Math.round((school.attendance_today_present / school.attendance_today_count) * 100) : null;
              return <article key={school.school_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(90px,0.7fr))_auto] lg:items-center">
                <div className="min-w-0"><p className="truncate font-medium">{school.school_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{school.school_code} · {[school.city, school.state].filter(Boolean).join(", ") || "Location not set"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{school.address || "Address not set"}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-1 text-sm">{statusLabel(school.school_status)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Students</p><p className="mt-1 text-sm tabular-nums">{count(school.student_count)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Staff</p><p className="mt-1 text-sm tabular-nums">{count(school.teacher_count)} teachers · {count(school.principal_count)} principals</p><p className="mt-1 text-xs text-muted-foreground">{school.principal_names || "Principal not assigned"}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Classes · attendance today</p><p className="mt-1 text-sm tabular-nums">{count(school.class_count)} · {attendance === null ? "No records" : attendance + "%"}</p></div>
                <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => openSchool(school.school_id)}>Open school <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={() => { setInviteSchool(school); setInviteEmail(""); }}>Prepare principal invite</Button></div>
              </article>;
            })}</div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="surface-panel p-5"><h2 className="font-display font-semibold">Recent network activity</h2><p className="mt-1 text-xs text-muted-foreground">School record creation is the available activity signal; no administrative audit feed is configured.</p>{loading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : error ? <p className="mt-4 text-sm text-muted-foreground">Unavailable while network data is loading.</p> : schools.length ? <ul className="mt-4 space-y-3">{schools.slice(0, 5).map((school) => <li key={school.school_id} className="flex justify-between gap-3 text-sm"><span className="truncate">{school.school_name} added to records</span><time className="shrink-0 text-muted-foreground">{new Date(school.school_created_at).toLocaleDateString("en-IN")}</time></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No recent school records are available.</p>}</article>
          <article className="surface-panel p-5"><h2 className="font-display font-semibold">Onboarding & tasks</h2><p className="mt-1 text-xs text-muted-foreground">Onboarding is derived from each assigned school’s database status.</p><p className="mt-4 text-sm">{loading ? "Loading onboarding status…" : error ? "Onboarding status unavailable." : count(pending) + " assigned school" + (pending === 1 ? "" : "s") + " pending onboarding"}</p><p className="mt-3 text-sm text-muted-foreground">Network-wide task assignments and live network reports are not connected to a franchise scope, so no totals are shown.</p></article>
        </section>
        {inactive > 0 && <p className="text-xs text-muted-foreground">Inactive assigned schools: {count(inactive)}. They remain visible for monitoring.</p>}
      </div>
      <Dialog open={!!inviteSchool} onOpenChange={(open) => { if (!open && !inviteLoading) setInviteSchool(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prepare principal signup</DialogTitle>
            <DialogDescription>For {inviteSchool?.school_name}. This saves an authorized school invite record; it does not send an email. The invitee must sign up with this email. Existing accounts need an authorized administrator to provision access.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">Principal email<Input type="email" autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label>
          <DialogFooter><Button variant="outline" onClick={() => setInviteSchool(null)} disabled={inviteLoading}>Cancel</Button><Button onClick={() => void createPrincipalInvite()} disabled={inviteLoading || !inviteEmail.trim()}>{inviteLoading ? "Saving…" : "Save invite record"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
