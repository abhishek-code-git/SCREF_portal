"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterScope } from "@/hooks/use-master";
import { supabase } from "@/integrations/supabase/client";

export function MasterFranchisesPage() {
  const scope = useMasterScope();
  const queryClient = useQueryClient();
  const [name, setName] = useState(""); const [territoryId, setTerritoryId] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const filtered = useMemo(() => scope.franchiseStats.filter((franchise) => (status === "all" || franchise.franchise_status === status) && `${franchise.franchise_name} ${franchise.territory ?? ""}`.toLowerCase().includes(search.toLowerCase())), [scope.franchiseStats, status, search]);
  const pageSize = 20; const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); const rows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const submit = async () => {
    if (!scope.masterId || !name.trim() || !territoryId) { setError("Enter a franchise name and choose one of your territories."); return; }
    setBusy(true); setError(null); setNotice(null);
    const { error: insertError } = await supabase.from("franchises").insert({ name: name.trim(), master_franchise_id: scope.masterId, territory_id: territoryId, status: "pending" });
    setBusy(false);
    if (insertError) setError(insertError.message); else { setName(""); setTerritoryId(""); setNotice("Sent to Central Admin for approval."); await queryClient.invalidateQueries({ queryKey: ["master-franchise-stats", scope.masterId] }); await queryClient.invalidateQueries({ queryKey: ["master-overview", scope.masterId] }); }
  };
  return <AppShell title="Franchises" subtitle="Request franchises within your authorized master network"><div className="space-y-5">
    {scope.isCentralPreview && <div role="status" className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">Previewing {scope.master?.name ?? "master franchise"} as Central Admin. This view is read-only.</div>}
    {!scope.isCentralPreview && scope.master && scope.master.status !== "active" && <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">Read only: your master franchise is {scope.master.status}.</div>}
    {scope.error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{scope.error}</div>}{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}{notice && <div role="status" className="surface-panel p-4 text-sm">{notice}</div>}
    {scope.loading ? <section className="surface-panel p-5 text-sm text-muted-foreground">Loading authorized franchises…</section> : !scope.masterId || !scope.master ? <section className="surface-panel p-5 text-sm text-muted-foreground">Choose an authorized master franchise to continue.</section> : <>
      {!scope.readOnly && <section className="surface-panel space-y-4 p-5"><div><h2 className="font-display font-semibold">Request new franchise</h2><p className="mt-1 text-sm text-muted-foreground">Requests start as pending and require Central Admin approval.</p></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input aria-label="Franchise name" placeholder="Franchise name" value={name} onChange={(event) => setName(event.target.value)} /><select aria-label="Territory" className="h-10 rounded-md border bg-background px-3 text-sm" value={territoryId} onChange={(event) => setTerritoryId(event.target.value)}><option value="">Choose territory</option>{scope.territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.territory}</option>)}</select><Button disabled={busy} onClick={() => void submit()}>{busy ? "Sending…" : "Request franchise"}</Button></div></section>}
      <section className="surface-panel overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row"><Input aria-label="Search franchises" placeholder="Search franchise or territory" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="sm:max-w-md" /><select aria-label="Filter status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="all">All statuses</option>{["pending", "active", "suspended", "inactive"].map((value) => <option key={value}>{value}</option>)}</select><p className="self-center text-sm text-muted-foreground">{filtered.length} franchises</p></div><div className="divide-y">{rows.map((franchise) => <article key={franchise.franchise_id} className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"><div><Link href={`/master/franchises/${franchise.franchise_id}`} className="font-medium text-primary hover:underline">{franchise.franchise_name}</Link><p className="mt-1 text-xs text-muted-foreground">{franchise.territory ?? "Territory not set"} · {franchise.school_count} schools · {franchise.student_count} students · {franchise.teacher_count} teachers</p><span className="mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs capitalize">{franchise.franchise_status === "pending" ? "Awaiting Central approval" : franchise.franchise_status}</span></div><Button asChild size="sm" variant="outline"><Link href={`/master/franchises/${franchise.franchise_id}`}>Open franchise</Link></Button></article>)}{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No franchises match this filter.</p>}</div><div className="flex items-center justify-between border-t p-4 text-sm"><span>Page {page + 1} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></section>
    </>}
  </div></AppShell>;
}
