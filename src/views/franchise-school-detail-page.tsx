"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Field, Pill, ReadOnlyBanner, StatGrid, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useFranchiseScope } from "@/hooks/use-franchise";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TeamMember = {
  kind: string;
  record_id: string;
  user_id: string | null;
  school_id: string;
  school_name: string;
  role: string;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
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

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-IN");
const statusTone = (s: string) => s === "active" ? "navy" as const : s === "rejected" ? "red" as const : "muted" as const;
const statusLabel = (s: string) => s === "onboarding" ? "Pending" : s === "rejected" ? "Declined" : s.charAt(0).toUpperCase() + s.slice(1);

export function FranchiseSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ctx = useFranchiseScope();
  const { setActiveMembership, setActiveSchool, memberships } = useSchoolContext();
  const schoolId = params.id;
  const { franchiseId, readOnly, loading: ctxLoading, error: ctxError, schools } = ctx;

  const school = useMemo(() => schools.find((s) => s.school_id === schoolId) ?? null, [schools, schoolId]);

  const compQuery = useQuery<Comparison | null, Error>({
    queryKey: ["franchise-school-comp", franchiseId, schoolId],
    enabled: !!franchiseId && !!schoolId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_school_comparison", { _franchise_id: franchiseId });
      if (e) throw e;
      return ((data ?? []) as Comparison[]).find((r) => r.school_id === schoolId) ?? null;
    },
  });

  const teamQuery = useQuery<TeamMember[], Error>({
    queryKey: ["franchise-school-team", franchiseId, schoolId],
    enabled: !!franchiseId && !!schoolId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_team_directory", { _franchise_id: franchiseId });
      if (e) throw e;
      return ((data ?? []) as TeamMember[]).filter((m) => m.school_id === schoolId);
    },
  });

  const comp = compQuery.data;
  const team = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);
  const loading = ctxLoading || compQuery.isPending || teamQuery.isPending;

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"school_principal" | "teacher" | "admissions_staff" | "accountant" | "transport_manager">("school_principal");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const openSchool = () => {
    const m = memberships.find((membership) => membership.role === "franchise_owner" && membership.school_id === schoolId);
    if (m) setActiveMembership(m.id);
    setActiveSchool(schoolId);
    router.push("/principal");
  };

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) { toast.error("Name and email are required."); return; }
    setInviteBusy(true);
    try {
      await inviteUser({
        email: inviteEmail.trim().toLowerCase(),
        full_name: inviteName.trim(),
        role: inviteRole,
        scope_kind: "school",
        scope_id: schoolId,
      });
      toast.success("Invite sent successfully.");
      setShowInvite(false);
      void teamQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMember) return;
    setRemoveBusy(true);
    try {
      if (removeMember.kind === "invite") {
        const { error: e } = await supabase.from("staff_invites").delete().eq("id", removeMember.record_id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("memberships").delete().eq("id", removeMember.record_id);
        if (e) throw e;
      }
      toast.success("Access removed.");
      setRemoveMember(null);
      void teamQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove access.");
    } finally {
      setRemoveBusy(false);
    }
  };

  if (!school && !loading) {
    return (
      <AppShell title="School Not Found">
        <div className="surface-panel flex flex-col items-center px-6 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-display text-base font-semibold">School not found</p>
          <p className="mt-1 text-sm text-muted-foreground">This school may not belong to your franchise or may have been removed.</p>
          <Button className="mt-5" asChild><Link href="/franchise/schools">Back to schools</Link></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={school?.name ?? "Loading…"} subtitle={school ? `${school.code} · ${[school.city, school.state].filter(Boolean).join(", ") || "Location not set"}` : ""}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href="/franchise/schools"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Schools</Link></Button>
          {school && <Pill tone={statusTone(school.status)}>{statusLabel(school.status)}</Pill>}
          {school?.status === "rejected" && school.decline_reason && <span className="text-sm text-destructive">{school.decline_reason}</span>}
        </div>

        {readOnly && <ReadOnlyBanner visible />}
        {ctxError && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{ctxError}</div>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading school details…</p>
        ) : school ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="surface-panel p-5"><Field label="Phone" value={school.phone || "—"} /></div>
              <div className="surface-panel p-5"><Field label="Email" value={school.email || "—"} /></div>
              <div className="surface-panel p-5"><Field label="Address" value={school.address || "—"} /></div>
              <div className="surface-panel p-5"><Field label="Academic Year" value={school.academic_year || "—"} /></div>
            </div>

            {comp && (
              <StatGrid items={[
                ["Students", n(comp.student_count)],
                ["Teachers", n(comp.teacher_count), comp.has_principal ? "Principal assigned" : "No principal"],
                ["Attendance 30d", comp.attendance_pct_30d != null ? `${comp.attendance_pct_30d}%` : "—"],
                ["Open Enquiries", n(comp.open_enquiries), `${n(comp.admitted_30d)} admitted last 30d`],
              ]} />
            )}

            <Panel
              title="Staff & invites"
              subtitle={`${team.length} member${team.length === 1 ? "" : "s"}`}
              action={!readOnly && school.status === "active" ? <Button size="sm" onClick={() => { setInviteName(""); setInviteEmail(""); setInviteRole("school_principal"); setShowInvite(true); }}>Invite staff</Button> : undefined}
            >
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff assigned to this school yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {team.map((m) => (
                    <div key={m.record_id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
                      </div>
                      <Pill tone={m.status === "active" ? "navy" : "muted"}>{m.role.replace(/_/g, " ")}</Pill>
                      {m.status === "invited-pending" && <Pill tone="muted">Invited</Pill>}
                      {!readOnly && (
                        <Button variant="ghost" size="sm" onClick={() => setRemoveMember(m)} className="text-destructive">Remove</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {school.status === "active" && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={openSchool}><ArrowUpRight className="mr-1 h-4 w-4" />Open school as principal</Button>
              </div>
            )}
          </>
        ) : null}

        {/* Invite dialog */}
        <Dialog open={showInvite} onOpenChange={(open) => { if (!inviteBusy) setShowInvite(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite staff to {school?.name}</DialogTitle>
              <DialogDescription>The person will receive an email invitation to join this school.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="space-y-1 text-sm"><span className="font-medium">Full name *</span><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Email *</span><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Role</span>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="school_principal">Principal</option>
                  <option value="teacher">Teacher</option>
                  <option value="admissions_staff">Admissions Staff</option>
                  <option value="accountant">Accountant</option>
                  <option value="transport_manager">Transport Manager</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)} disabled={inviteBusy}>Cancel</Button>
              <Button onClick={() => void handleInvite()} disabled={inviteBusy || !inviteName.trim() || !inviteEmail.trim()}>{inviteBusy ? "Sending…" : "Send invite"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove confirmation */}
        <ConfirmDialog
          open={!!removeMember}
          onOpenChange={(open) => { if (!open) setRemoveMember(null); }}
          title="Remove access"
          description={`Remove ${removeMember?.full_name}'s ${removeMember?.role.replace(/_/g, " ")} access from ${school?.name ?? "this school"}? They will lose all access immediately.`}
          confirmLabel="Remove"
          destructive
          busy={removeBusy}
          onConfirm={handleRemoveMember}
        />
      </div>
    </AppShell>
  );
}
