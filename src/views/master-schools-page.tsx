"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterScope } from "@/hooks/use-master";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";

type NetworkSchool = { school_id: string; school_code: string; school_name: string; city: string; state: string; academic_year: string; school_status: string; student_count: number; teacher_count: number; principal_count: number; principal_names: string | null; class_count: number; attendance_today_count: number; attendance_today_present: number };
type SchoolRelation = { id: string; franchise_id: string | null };
type MasterSchool = NetworkSchool & { franchise_id: string | null; franchise_name: string };

export function MasterSchoolsPage() {
  const scope = useMasterScope();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [franchiseFilter, setFranchiseFilter] = useState("all"); const [page, setPage] = useState(0);
  const [inviteSchool, setInviteSchool] = useState<MasterSchool | null>(null); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const schoolsQuery = useQuery<MasterSchool[], Error>({
    queryKey: ["master-schools", scope.masterId, scope.franchiseStats.map((item) => item.franchise_id)], enabled: !!scope.masterId && !scope.loading,
    queryFn: async () => {
      if (scope.franchiseStats.length === 0) return [];
      const [network, relations] = await Promise.all([
        supabase.rpc("franchise_network_dashboard", { _master_franchise_id: scope.masterId, _franchise_id: null }),
        supabase.from("schools").select("id,franchise_id"),
      ]);
      const problem = network.error ?? relations.error; if (problem) throw problem;
      const relationMap = new Map((relations.data ?? []).map((item) => [item.id, item.franchise_id]));
      return ((network.data ?? []) as NetworkSchool[]).map((item) => { const franchiseId = relationMap.get(item.school_id) ?? null; return { ...item, franchise_id: franchiseId, franchise_name: scope.franchiseStats.find((franchise) => franchise.franchise_id === franchiseId)?.franchise_name ?? "Franchise unavailable" }; });
    },
  });
  const schools = useMemo(() => schoolsQuery.data ?? [], [schoolsQuery.data]);
  const filtered = useMemo(() => schools.filter((school) => (status === "all" || school.school_status === status) && (franchiseFilter === "all" || school.franchise_id === franchiseFilter) && `${school.school_name} ${school.school_code} ${school.city} ${school.state}`.toLowerCase().includes(search.toLowerCase())), [schools, status, franchiseFilter, search]);
  const pageSize = 20; const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const rows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const submitInvite = async () => {
    if (!inviteSchool || !name.trim() || !email.trim()) { setError("Enter the principal's name and email address."); return; }
    setBusy(true); setError(null); setNotice(null);
    try { const result = await inviteUser({ email: email.trim(), full_name: name.trim(), phone: phone.trim() || undefined, role: "school_principal", scope_kind: "school", scope_id: inviteSchool.school_id }); setName(""); setEmail(""); setPhone(""); setInviteSchool(null); setNotice(result.invited ? "Principal invitation sent." : "Principal access assigned to the existing account."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to invite this principal."); } finally { setBusy(false); }
  };
  return <AppShell title="Schools" subtitle="Schools and aggregate performance across your master franchise"><div className="space-y-5">
    {scope.isCentralPreview && <div role="status" className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">Previewing {scope.master?.name ?? "master franchise"} as Central Admin. This view is read-only.</div>}
    {!scope.isCentralPreview && scope.master && scope.master.status !== "active" && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">Read only: your master franchise is {scope.master.status}.</div>}
    {scope.error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{scope.error}</div>}{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}{notice && <div role="status" className="surface-panel p-4 text-sm">{notice}</div>}
    {inviteSchool && <section className="surface-panel space-y-4 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display font-semibold">Invite principal</h2><p className="text-sm text-muted-foreground">{inviteSchool.school_name}</p></div><Button size="sm" variant="outline" onClick={() => setInviteSchool(null)}>Cancel</Button></div><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Principal name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} /><Input aria-label="Principal email" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><Input aria-label="Principal phone" placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} /></div><Button disabled={busy} onClick={() => void submitInvite()}>{busy ? "Sending…" : "Invite principal"}</Button></section>}
    <section className="surface-panel overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 lg:flex-row"><Input aria-label="Search schools" placeholder="Search school, code, or city" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><select aria-label="Filter by franchise" className="h-10 rounded-md border bg-background px-3 text-sm" value={franchiseFilter} onChange={(event) => { setFranchiseFilter(event.target.value); setPage(0); }}><option value="all">All franchises</option>{scope.franchiseStats.map((franchise) => <option value={franchise.franchise_id} key={franchise.franchise_id}>{franchise.franchise_name}</option>)}</select><select aria-label="Filter by status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="all">All statuses</option>{["active", "onboarding", "suspended", "rejected"].map((item) => <option key={item}>{item}</option>)}</select><span className="self-center text-sm text-muted-foreground">{filtered.length} schools</span></div>{schoolsQuery.error && <p role="alert" className="border-b p-5 text-sm text-destructive">Schools could not be loaded: {schoolsQuery.error.message}</p>}{scope.loading || schoolsQuery.isPending ? <p className="p-5 text-sm text-muted-foreground">Loading authorized schools…</p> : <div className="divide-y">{rows.map((school) => <article key={school.school_id} className="flex flex-col gap-3 p-5 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><p className="font-medium">{school.school_name} <span className="text-xs text-muted-foreground">{school.school_code}</span></p><p className="mt-1 text-xs text-muted-foreground">{school.franchise_name} · {[school.city, school.state].filter(Boolean).join(", ")} · {school.academic_year}</p><p className="mt-2 text-xs text-muted-foreground">{school.student_count} students · {school.teacher_count} teachers · {school.principal_names ?? "No principal assigned"} · attendance {school.attendance_today_present}/{school.attendance_today_count}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-2 py-1 text-xs">{school.school_status === "onboarding" ? "Awaiting Central approval" : school.school_status}</span>{school.school_status === "active" && !scope.readOnly && <Button size="sm" variant="outline" onClick={() => { setInviteSchool(school); setError(null); }}>Invite principal</Button>}</div></article>)}{rows.length === 0 && !schoolsQuery.error && <p className="p-8 text-center text-sm text-muted-foreground">No schools match these filters.</p>}</div>}<div className="flex items-center justify-between border-t p-4 text-sm"><span>Page {page + 1} of {pageCount}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></section>
  </div></AppShell>;
}
