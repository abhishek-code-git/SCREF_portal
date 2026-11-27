"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Field, Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEADERSHIP, ROLE_LABELS, useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

export function SettingsPage() {
  const { user, activeSchool, activeRole, ready, error: accessError } = useSchoolContext();
  const { profile } = useWorkspace();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const isLeadership = !!activeRole && LEADERSHIP.includes(activeRole);

  // School profile fields (leadership only)
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Personal account fields
  const [myName, setMyName] = useState("");
  const [myPhone, setMyPhone] = useState("");

  useEffect(() => {
    if (activeSchool) {
      setPhone(activeSchool.phone ?? "");
      setEmail(activeSchool.email ?? "");
      setAddress(activeSchool.address ?? "");
      setCity(activeSchool.city ?? "");
      setState(activeSchool.state ?? "");
      setPrincipalName(activeSchool.principal_name ?? "");
      setLogoUrl(activeSchool.logo_url ?? "");
    }
  }, [activeSchool]);

  useEffect(() => {
    if (profile) {
      setMyName(profile.full_name ?? "");
      setMyPhone(profile.phone ?? "");
    }
  }, [profile]);

  const franchiseQuery = useQuery<string | null, Error>({
    queryKey: ["school-franchise-name", activeSchool?.id, activeSchool?.franchise_id],
    enabled: !!activeSchool?.franchise_id && isLeadership,
    queryFn: async () => {
      if (!activeSchool?.franchise_id) return null;
      const { data, error } = await supabase
        .from("franchises")
        .select("name")
        .eq("id", activeSchool.franchise_id)
        .maybeSingle();
      if (error) return null;
      return data?.name ?? null;
    },
  });

  const saveSchoolMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const { error } = await supabase.rpc("update_school_profile", {
        _school_id: activeSchool.id,
        _phone: phone.trim(),
        _email: email.trim(),
        _address: address.trim(),
        _city: city.trim(),
        _state: state.trim(),
        _principal_name: principalName.trim(),
        _logo_url: logoUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("School profile updated");
      await queryClient.invalidateQueries({ queryKey: ["school-context", user?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProfileMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: myName.trim(), phone: myPhone.trim() })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Account profile saved");
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendPasswordReset = async () => {
    if (!user?.email) {
      toast.error("No email found on account");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Password reset email sent to ${user.email}`);
  };

  if (!ready) return <AppShell title="Settings"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Settings"><Panel title="Error">{accessError}</Panel></AppShell>;

  return (
    <AppShell
      title="Settings"
      subtitle={activeSchool ? `${activeSchool.name} · Profile & account` : "Account settings"}
    >
      <div className="space-y-6">
        {isLeadership && <PrincipalBreadcrumb items={[{ label: "Settings" }]} />}

        <div className="grid gap-6 lg:grid-cols-2">
          {isLeadership && activeSchool && (
            <Panel
              title="School profile"
              subtitle="Protected fields (code, status, franchise, academic year) can only be changed by Central Admin"
            >
              <div className="mb-5 grid gap-3 rounded-lg bg-surface p-4 sm:grid-cols-2">
                <Field label="School Code" value={activeSchool.code} />
                <Field label="Academic Year" value={activeSchool.academic_year} />
                <Field label="Status" value={<Pill tone={activeSchool.status === "active" ? "navy" : "red"}>{activeSchool.status}</Pill>} />
                <Field label="Franchise" value={franchiseQuery.data ?? (activeSchool.franchise_id ? "Assigned" : "Direct")} />
              </div>

              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (isWritable) saveSchoolMut.mutate();
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label>Principal name</Label>
                  <Input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>School phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>School email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>Logo URL (optional)</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isWritable} />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={!isWritable || saveSchoolMut.isPending}>
                    {saveSchoolMut.isPending ? "Saving…" : "Save school profile"}
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          <Panel title="My account" subtitle="Your personal profile and password">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (myName.trim()) saveProfileMut.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Full name *</Label>
                  <Input required value={myName} onChange={(e) => setMyName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} />
                </div>
                <Field label="Email" value={user?.email ?? "—"} />
                <Field label="Role" value={activeRole ? ROLE_LABELS[activeRole] : "—"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!myName.trim() || saveProfileMut.isPending}>
                  {saveProfileMut.isPending ? "Saving…" : "Save account"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void sendPasswordReset()}>
                  Send password reset link
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
