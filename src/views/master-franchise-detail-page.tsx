"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterScope, type MasterFranchiseStat } from "@/hooks/use-master";
import { useSessionUser } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";
import { INDIAN_STATES_AND_UTS } from "@/lib/indian-states";

type NetworkSchool = { school_id: string; school_code: string; school_name: string; city: string; state: string; address: string; academic_year: string; school_status: string; student_count: number; teacher_count: number; principal_count: number; principal_names: string | null; class_count: number; attendance_today_count: number; attendance_today_present: number };
type OwnerRow = { id: string; user_id: string; full_name: string | null; phone: string };
const academicYear = () => { const year = new Date().getFullYear(); return `${year}-${String((year + 1) % 100).padStart(2, "0")}`; };

export function MasterFranchiseDetailPage({ id }: { id: string }) {
  const scope = useMasterScope(); const { user } = useSessionUser(); const queryClient = useQueryClient();
  const franchise = scope.franchiseStats.find((item) => item.franchise_id === id) ?? null;
  const authorized = !!franchise && scope.masterId.length > 0;
  const [ownerName, setOwnerName] = useState(""); const [ownerEmail, setOwnerEmail] = useState(""); const [ownerPhone, setOwnerPhone] = useState("");
  const [schoolForm, setSchoolForm] = useState({ name: "", city: "", state: "", address: "", academic_year: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const schoolQuery = useQuery<NetworkSchool[], Error>({
    queryKey: ["master-franchise-schools", id], enabled: authorized,
    queryFn: async () => { const { data, error } = await supabase.rpc("franchise_network_dashboard", { _master_franchise_id: null, _franchise_id: id }); if (error) throw error; return (data ?? []) as NetworkSchool[]; },
  });
  const ownersQuery = useQuery<OwnerRow[], Error>({
    queryKey: ["master-franchise-owners", id], enabled: authorized,
    queryFn: async () => {
      const { data, error } = await supabase.from("memberships").select("id,user_id").eq("franchise_id", id).eq("role", "franchise_owner"); if (error) throw error;
      const rows = data ?? []; const userIds = [...new Set(rows.map((item) => item.user_id))];
      const profiles = userIds.length ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", userIds) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const profileById = new Map((profiles.data ?? []).map((item) => [item.user_id, item]));
      return rows.map((item) => ({ id: item.id, user_id: item.user_id, full_name: profileById.get(item.user_id)?.full_name ?? null, phone: profileById.get(item.user_id)?.phone ?? "" }));
    },
  });
  const settingQuery = useQuery<string | null, Error>({
    queryKey: ["master-default-academic-year", scope.masterId], enabled: !!scope.masterId,
    queryFn: async () => { const { data, error } = await supabase.from("network_settings").select("setting_value").eq("setting_key", "default_academic_year").maybeSingle(); if (error) throw error; return typeof data?.setting_value === "string" ? data.setting_value : null; },
  });
  const schools = useMemo(() => schoolQuery.data ?? [], [schoolQuery.data]);
  const totalCounts = useMemo(() => ({ students: schools.reduce((sum, item) => sum + item.student_count, 0), teachers: schools.reduce((sum, item) => sum + item.teacher_count, 0) }), [schools]);
  const inviteOwner = async () => {
    if (!ownerName.trim() || !ownerEmail.trim()) { setError("Enter the owner's name and email address."); return; }
    setBusy(true); setError(null); setNotice(null);
    try { const result = await inviteUser({ email: ownerEmail.trim(), full_name: ownerName.trim(), phone: ownerPhone.trim() || undefined, role: "franchise_owner", scope_kind: "franchise", scope_id: id }); setOwnerName(""); setOwnerEmail(""); setOwnerPhone(""); setNotice(result.invited ? "Invitation sent. The franchise owner can set a password from the email." : "Franchise owner access assigned to the existing account."); await queryClient.invalidateQueries({ queryKey: ["master-franchise-owners", id] }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to invite this franchise owner."); } finally { setBusy(false); }
  };
  const removeOwner = async (membershipId: string) => { if (!window.confirm("Remove this franchise owner's access?")) return; const { error } = await supabase.from("memberships").delete().eq("id", membershipId); if (error) setError(error.message); else await queryClient.invalidateQueries({ queryKey: ["master-franchise-owners", id] }); };
  const requestSchool = async () => {
    if (!user || !scope.masterId || !schoolForm.name.trim()) { setError("Enter a school name and sign in again if your session expired."); return; }
    setBusy(true); setError(null); setNotice(null);
    const { error } = await supabase.from("schools").insert({ name: schoolForm.name.trim(), city: schoolForm.city.trim(), state: schoolForm.state.trim(), address: schoolForm.address.trim(), academic_year: schoolForm.academic_year || settingQuery.data || academicYear(), status: "onboarding", franchise_id: id, created_by: user.id });
    setBusy(false);
    if (error) setError(error.message); else { setSchoolForm({ name: "", city: "", state: "", address: "", academic_year: "" }); setNotice("School request sent to Central Admin for approval."); await queryClient.invalidateQueries({ queryKey: ["master-franchise-schools", id] }); await queryClient.invalidateQueries({ queryKey: ["master-franchise-stats", scope.masterId] }); await queryClient.invalidateQueries({ queryKey: ["master-overview", scope.masterId] }); }
  };
  return <AppShell title={franchise?.franchise_name ?? "Franchise details"} subtitle="Manage this franchise within your master network">
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/master/franchises">Back to franchises</Link></Button><Button asChild variant="outline"><Link href="/master/schools">All network schools</Link></Button></div>
      {scope.isCentralPreview && <div role="status" className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">Previewing {scope.master?.name ?? "master franchise"} as Central Admin. This view is read-only.</div>}
      {!scope.isCentralPreview && scope.master && scope.master.status !== "active" && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">Read only: your master franchise is {scope.master.status}.</div>}
      {scope.error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{scope.error}</div>}{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}{notice && <div role="status" className="surface-panel p-4 text-sm">{notice}</div>}
      {scope.loading || (authorized && (schoolQuery.isPending || ownersQuery.isPending)) ? <section className="surface-panel p-5 text-sm text-muted-foreground">Loading franchise details…</section> : !authorized || !franchise ? <section className="surface-panel p-5 text-sm text-muted-foreground">This franchise is not part of your authorized master network.</section> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article className="surface-panel p-5"><p className="text-xs uppercase text-muted-foreground">Status</p><p className="mt-2 font-semibold capitalize">{franchise.franchise_status}</p></article><article className="surface-panel p-5"><p className="text-xs uppercase text-muted-foreground">Territory</p><p className="mt-2 font-semibold">{franchise.territory ?? "Not assigned"}</p></article><article className="surface-panel p-5"><p className="text-xs uppercase text-muted-foreground">Schools</p><p className="mt-2 font-semibold">{franchise.active_school_count} active · {franchise.school_count} total</p></article><article className="surface-panel p-5"><p className="text-xs uppercase text-muted-foreground">Students · teachers</p><p className="mt-2 font-semibold">{totalCounts.students} · {totalCounts.teachers}</p></article></section>
        {franchise.franchise_status === "active" && !scope.readOnly && <section className="surface-panel space-y-4 p-5"><h2 className="font-display font-semibold">Invite franchise owner</h2><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Owner name" placeholder="Full name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /><Input aria-label="Owner email" type="email" placeholder="Email address" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} /><Input aria-label="Owner phone" placeholder="Phone (optional)" value={ownerPhone} onChange={(event) => setOwnerPhone(event.target.value)} /></div><Button disabled={busy} onClick={() => void inviteOwner()}>{busy ? "Sending…" : "Invite franchise owner"}</Button></section>}
        <section className="surface-panel p-5"><h2 className="font-display font-semibold">Franchise owners</h2>{ownersQuery.error && <p role="alert" className="mt-2 text-sm text-destructive">{ownersQuery.error.message}</p>}{ownersQuery.data?.length ? <div className="mt-3 divide-y">{ownersQuery.data.map((owner) => <div key={owner.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{owner.full_name ?? "Name not provided"}</p><p className="text-xs text-muted-foreground">{owner.phone || "Phone not provided"}</p></div>{!scope.readOnly && franchise.franchise_status === "active" && <Button size="sm" variant="outline" onClick={() => void removeOwner(owner.id)}>Remove</Button>}</div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No franchise owner has been assigned.</p>}</section>
        {franchise.franchise_status === "active" && !scope.readOnly && <section className="surface-panel space-y-4 p-5"><div><h2 className="font-display font-semibold">Request a school</h2><p className="mt-1 text-sm text-muted-foreground">The request starts in onboarding and waits for Central Admin approval. Its school code is generated by the database.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Input aria-label="School name" placeholder="School name" value={schoolForm.name} onChange={(event) => setSchoolForm({ ...schoolForm, name: event.target.value })} /><Input aria-label="City" placeholder="City" value={schoolForm.city} onChange={(event) => setSchoolForm({ ...schoolForm, city: event.target.value })} /><Input list="master-indian-states" aria-label="State" placeholder="State" value={schoolForm.state} onChange={(event) => setSchoolForm({ ...schoolForm, state: event.target.value })} /><datalist id="master-indian-states">{INDIAN_STATES_AND_UTS.map((state) => <option key={state} value={state} />)}</datalist><Input aria-label="Address" placeholder="Address" value={schoolForm.address} onChange={(event) => setSchoolForm({ ...schoolForm, address: event.target.value })} /><Input aria-label="Academic year" placeholder="Academic year" value={schoolForm.academic_year || settingQuery.data || academicYear()} onChange={(event) => setSchoolForm({ ...schoolForm, academic_year: event.target.value })} /></div><Button disabled={busy} onClick={() => void requestSchool()}>{busy ? "Sending…" : "Request school"}</Button></section>}
        <section className="surface-panel overflow-hidden"><div className="border-b p-5"><h2 className="font-display font-semibold">Schools</h2></div>{schoolQuery.error && <p role="alert" className="p-5 text-sm text-destructive">{schoolQuery.error.message}</p>}{schools.length ? <div className="divide-y">{schools.map((school) => <article key={school.school_id} className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"><div><p className="font-medium">{school.school_name} <span className="text-xs text-muted-foreground">{school.school_code}</span></p><p className="mt-1 text-xs text-muted-foreground">{[school.city, school.state].filter(Boolean).join(", ")} · {school.student_count} students · {school.teacher_count} teachers · {school.principal_names ?? "No principal"}</p></div><span className="rounded-full border px-2 py-1 text-xs capitalize">{school.school_status === "onboarding" ? "Awaiting Central approval" : school.school_status}</span></article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No schools are linked to this franchise yet.</p>}</section>
      </>}
    </div>
  </AppShell>;
}
