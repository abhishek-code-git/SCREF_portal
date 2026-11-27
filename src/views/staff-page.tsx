"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, useSchoolContext, useSchoolWritable, type AppRole } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";

type StaffRow = {
  membership_id: string;
  user_id: string;
  role: AppRole;
  full_name: string;
  phone: string;
  email: string;
  last_sign_in_at: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
};

const STAFF_ROLES: AppRole[] = ["teacher", "admissions_staff", "accountant", "transport_manager"];

export function StaffPage() {
  const { user, activeSchool, activeRole, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("teacher");
  const [confirmRemove, setConfirmRemove] = useState<StaffRow | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ["school-staff", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) throw new Error("No school");
      const [dirRes, clsRes, assignRes, invRes] = await Promise.all([
        supabase.rpc("school_staff_directory", { _school_id: activeSchool.id }),
        supabase.from("classes").select("id,name,section,class_teacher").eq("school_id", activeSchool.id),
        supabase.from("class_teacher_assignments").select("class_id,teacher_user_id,subject_name").eq("school_id", activeSchool.id).eq("is_active", true),
        supabase.from("staff_invites").select("id,email,role,created_at").eq("school_id", activeSchool.id).is("accepted_at", null).order("created_at", { ascending: false }),
      ]);
      const err = dirRes.error ?? clsRes.error ?? assignRes.error ?? invRes.error;
      if (err) throw err;

      const classes = clsRes.data ?? [];
      const classMap = new Map(classes.map((c) => [c.id, `${c.name}-${c.section}`]));
      const teacherClasses = new Map<string, string[]>();

      for (const c of classes) {
        if (c.class_teacher) {
          const arr = teacherClasses.get(c.class_teacher) ?? [];
          arr.push(`${c.name}-${c.section} (Class teacher)`);
          teacherClasses.set(c.class_teacher, arr);
        }
      }
      for (const a of assignRes.data ?? []) {
        if (a.subject_name === "Class teacher") continue;
        const arr = teacherClasses.get(a.teacher_user_id) ?? [];
        const clsName = classMap.get(a.class_id) ?? "Class";
        arr.push(`${clsName} (${a.subject_name})`);
        teacherClasses.set(a.teacher_user_id, arr);
      }

      return {
        staff: (dirRes.data ?? []) as StaffRow[],
        invites: (invRes.data ?? []) as InviteRow[],
        teacherClasses,
        classTeacherIds: new Set(classes.map((c) => c.class_teacher).filter(Boolean) as string[]),
      };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school-staff", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["school-classes-mgmt", activeSchool?.id] });
    await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
  };

  const inviteMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      return inviteUser({
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
        scope_kind: "school",
        scope_id: activeSchool.id,
      });
    },
    onSuccess: async (res) => {
      setEmail("");
      setFullName("");
      setPhone("");
      toast.success(res?.invited ? "Invitation email sent" : "Access assigned to existing account");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: async (person: StaffRow) => {
      if (!activeSchool) return;
      // Clear class_teacher & subject assignments first, then delete membership (DB trigger also enforces this)
      if (person.role === "teacher") {
        await supabase
          .from("classes")
          .update({ class_teacher: null })
          .eq("school_id", activeSchool.id)
          .eq("class_teacher", person.user_id);
        await supabase
          .from("class_teacher_assignments")
          .update({ is_active: false })
          .eq("school_id", activeSchool.id)
          .eq("teacher_user_id", person.user_id);
      }
      const { error } = await supabase.from("memberships").delete().eq("id", person.membership_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmRemove(null);
      toast.success("Staff access removed");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteInviteMut = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("staff_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Pending invite removed");
      await refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resendInvite = async (inv: InviteRow) => {
    if (!activeSchool || !isWritable) return;
    setResendingId(inv.id);
    try {
      const res = await inviteUser({
        email: inv.email,
        full_name: inv.email.split("@")[0] || inv.email,
        role: inv.role,
        scope_kind: "school",
        scope_id: activeSchool.id,
      });
      toast.success(res.invited ? `Invitation resent to ${inv.email}` : `Access granted for ${inv.email}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  if (!ready) return <AppShell title="Teachers & Staff"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Teachers & Staff"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Teachers & Staff"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const staff = staffQuery.data?.staff ?? [];
  const invites = staffQuery.data?.invites ?? [];
  const teacherClasses = staffQuery.data?.teacherClasses ?? new Map<string, string[]>();
  const classTeacherIds = staffQuery.data?.classTeacherIds ?? new Set<string>();

  const canManagePerson = (person: StaffRow) => {
    if (!isWritable || person.user_id === user?.id) return false;
    if (person.role === "school_principal" && activeRole === "school_principal") return false;
    return true;
  };

  return (
    <AppShell title="Teachers & Staff" subtitle={`${activeSchool.name} · ${staff.length} active member(s)`}>
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Teachers & Staff" }]} />

        <Panel title="Invite staff member" subtitle="Send an invitation email or assign an existing account to this school">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (isWritable && email.trim() && fullName.trim()) inviteMut.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="space-y-1">
              <Label>Full name *</Label>
              <Input required placeholder="Staff full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!isWritable} />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input required type="email" placeholder="teacher@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isWritable} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input placeholder="Optional phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isWritable} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                disabled={!isWritable}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={!isWritable || inviteMut.isPending}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {inviteMut.isPending ? "Inviting…" : "Invite staff"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Active staff directory" subtitle="Memberships, assigned classes, and last sign-in">
          {staffQuery.isPending ? (
            <p className="py-6 text-sm text-muted-foreground">Loading staff…</p>
          ) : staffQuery.error ? (
            <p role="alert" className="py-4 text-sm text-destructive">{staffQuery.error.message}</p>
          ) : staff.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No staff members found for this school.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium">Classes assigned</th>
                    <th className="px-3 py-2.5 font-medium">Last sign-in</th>
                    <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staff.map((person) => {
                    const classesList = teacherClasses.get(person.user_id) ?? [];
                    return (
                      <tr key={person.membership_id} className="hover:bg-surface/60">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{person.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[person.email, person.phone].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Pill tone="navy">{ROLE_LABELS[person.role]}</Pill>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {classesList.length > 0 ? classesList.join(", ") : person.role === "teacher" ? "No classes assigned" : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {person.last_sign_in_at
                            ? new Date(person.last_sign_in_at).toLocaleString("en-IN")
                            : "Never signed in"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {canManagePerson(person) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isWritable}
                              onClick={() => setConfirmRemove(person)}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove access
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {invites.length > 0 && (
          <Panel title="Pending invites" subtitle="Invitations waiting for user sign-up">
            <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[inv.role]} · Created {new Date(inv.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isWritable || resendingId === inv.id}
                      onClick={() => void resendInvite(inv)}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {resendingId === inv.id ? "Sending…" : "Resend invite"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Cancel invite for ${inv.email}`}
                      disabled={!isWritable || deleteInviteMut.isPending}
                      onClick={() => deleteInviteMut.mutate(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}
        title="Remove staff access"
        description={
          confirmRemove && classTeacherIds.has(confirmRemove.user_id)
            ? `${confirmRemove.full_name} is currently assigned as a class teacher. Removing their access will unassign them from all classes and deactivate their teaching assignments first.`
            : `Remove ${confirmRemove?.full_name ?? "this staff member"} from ${activeSchool.name}? Their Auth account will remain intact.`
        }
        confirmLabel="Remove access"
        destructive
        busy={removeMut.isPending}
        onConfirm={() => { if (confirmRemove) removeMut.mutate(confirmRemove); }}
      />
    </AppShell>
  );
}
