"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Pill, ReadOnlyBanner } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFranchiseScope } from "@/hooks/use-franchise";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";

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

const ROLE_OPTIONS = ["school_principal", "teacher", "admissions_staff", "accountant", "transport_manager"] as const;
const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function FranchiseTeamPage() {
  const { franchiseId, readOnly, preview, loading: ctxLoading, error: ctxError, scope, schools } = useFranchiseScope();

  const teamQuery = useQuery<TeamMember[], Error>({
    queryKey: ["franchise-team", franchiseId],
    enabled: !!franchiseId,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("franchise_team_directory", { _franchise_id: franchiseId });
      if (e) throw e;
      return (data ?? []) as TeamMember[];
    },
  });

  const team = useMemo(() => teamQuery.data ?? [], [teamQuery.data]);
  const loading = ctxLoading || teamQuery.isPending;

  const [q, setQ] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  const shown = useMemo(() => team.filter((m) => {
    if (q && !`${m.full_name} ${m.email} ${m.school_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (schoolFilter !== "All" && m.school_id !== schoolFilter) return false;
    if (roleFilter !== "All" && m.role !== roleFilter) return false;
    return true;
  }), [team, q, schoolFilter, roleFilter]);

  const uniqueSchools = useMemo(() => {
    const map = new Map<string, string>();
    team.forEach((m) => map.set(m.school_id, m.school_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [team]);

  const uniqueRoles = useMemo(() => [...new Set(team.map((m) => m.role))].sort(), [team]);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<typeof ROLE_OPTIONS[number]>("teacher");
  const [inviteSchoolId, setInviteSchoolId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const activeSchools = useMemo(() => schools.filter((s) => s.status === "active"), [schools]);

  const openInvite = () => {
    setInviteName(""); setInviteEmail(""); setInviteRole("teacher");
    setInviteSchoolId(activeSchools[0]?.school_id ?? "");
    setShowInvite(true);
  };

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteSchoolId) { toast.error("All fields are required."); return; }
    setInviteBusy(true);
    try {
      await inviteUser({
        email: inviteEmail.trim().toLowerCase(),
        full_name: inviteName.trim(),
        role: inviteRole,
        scope_kind: "school",
        scope_id: inviteSchoolId,
      });
      toast.success("Invite sent.");
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
      toast.error(err instanceof Error ? err.message : "Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <AppShell title="Team" subtitle={scope?.name ?? "Franchise"} actions={!readOnly && activeSchools.length > 0 ? <Button size="sm" onClick={openInvite}><UserPlus className="mr-2 h-4 w-4" />Invite staff</Button> : undefined}>
      <div className="space-y-6">
        {readOnly && <ReadOnlyBanner visible />}
        {preview && <div role="status" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-medium">Preview mode — read-only.</div>}
        {ctxError && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{ctxError}</div>}

        <div className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, or school…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            {uniqueSchools.length > 1 && (
              <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="h-9 max-w-48 rounded-md border border-input bg-background px-2 text-xs sm:text-sm">
                <option value="All">All schools</option>
                {uniqueSchools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
            {uniqueRoles.length > 1 && (
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 max-w-40 rounded-md border border-input bg-background px-2 text-xs sm:text-sm">
                <option value="All">All roles</option>
                {uniqueRoles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            )}
          </div>

          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading team…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-display text-base font-semibold">{q || schoolFilter !== "All" || roleFilter !== "All" ? "No members match your filter" : "No team members yet"}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Invite staff to your active schools to build your team.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {shown.map((m) => (
                <div key={m.record_id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{m.school_name}</p>
                  </div>
                  <Pill tone={m.status === "active" ? "navy" : "muted"}>{roleLabel(m.role)}</Pill>
                  {m.status === "invited-pending" && <Pill tone="muted">Invited</Pill>}
                  {!readOnly && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoveMember(m)} className="text-destructive">Remove</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite dialog */}
        <Dialog open={showInvite} onOpenChange={(open) => { if (!inviteBusy) setShowInvite(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite staff</DialogTitle>
              <DialogDescription>Add a new team member to one of your active schools.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="space-y-1 text-sm"><span className="font-medium">Full name *</span><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Email *</span><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">School</span>
                <select value={inviteSchoolId} onChange={(e) => setInviteSchoolId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {activeSchools.map((s) => <option key={s.school_id} value={s.school_id}>{s.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Role</span>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)} disabled={inviteBusy}>Cancel</Button>
              <Button onClick={() => void handleInvite()} disabled={inviteBusy || !inviteName.trim() || !inviteEmail.trim() || !inviteSchoolId}>{inviteBusy ? "Sending…" : "Send invite"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove confirmation */}
        <ConfirmDialog
          open={!!removeMember}
          onOpenChange={(open) => { if (!open) setRemoveMember(null); }}
          title="Remove access"
          description={`Remove ${removeMember?.full_name}'s ${roleLabel(removeMember?.role ?? "")} access from ${removeMember?.school_name ?? "this school"}?`}
          confirmLabel="Remove"
          destructive
          busy={removeBusy}
          onConfirm={handleRemoveMember}
        />
      </div>
    </AppShell>
  );
}
