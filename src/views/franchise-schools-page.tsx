"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, Pill, ReadOnlyBanner } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFranchiseScope, type FranchiseSchool } from "@/hooks/use-franchise";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

const statusTone = (s: string) => s === "active" ? "navy" as const : s === "rejected" ? "red" as const : "muted" as const;
const statusLabel = (s: string) => s === "onboarding" ? "Pending" : s === "rejected" ? "Declined" : s.charAt(0).toUpperCase() + s.slice(1);

export function FranchiseSchoolsPage() {
  const router = useRouter();
  const { franchiseId, schools, readOnly, preview, loading, error, refresh, defaultAcademicYear, scope } = useFranchiseScope();
  const { setActiveMembership, setActiveSchool, memberships } = useSchoolContext();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [editSchool, setEditSchool] = useState<FranchiseSchool | null>(null);
  const [cancelSchool, setCancelSchool] = useState<FranchiseSchool | null>(null);
  const [busy, setBusy] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formYear, setFormYear] = useState("");

  const shown = schools.filter((s) => {
    if (q && !`${s.name} ${s.code} ${s.city}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter !== "All") {
      if (statusFilter === "Pending" && s.status !== "onboarding") return false;
      if (statusFilter === "Active" && s.status !== "active") return false;
      if (statusFilter === "Declined" && s.status !== "rejected") return false;
      if (statusFilter === "Suspended" && s.status !== "suspended") return false;
    }
    return true;
  });

  const openSchool = (schoolId: string) => {
    const m = memberships.find((membership) => membership.role === "franchise_owner" && membership.school_id === schoolId);
    if (m) setActiveMembership(m.id);
    setActiveSchool(schoolId);
    router.push("/principal");
  };

  const openNew = () => {
    setFormName(""); setFormCity(""); setFormState(""); setFormAddress("");
    setFormYear(defaultAcademicYear);
    setShowNew(true);
  };

  const openEdit = (school: FranchiseSchool) => {
    setFormName(school.name); setFormCity(school.city); setFormState(school.state);
    setFormAddress(school.address); setFormYear(school.academic_year);
    setEditSchool(school);
  };

  const handleRequestSchool = async () => {
    if (!formName.trim()) { toast.error("School name is required."); return; }
    setBusy(true);
    try {
      const { error: e } = await supabase.from("schools").insert({
        name: formName.trim(),
        city: formCity.trim(),
        state: formState.trim(),
        address: formAddress.trim(),
        academic_year: formYear.trim() || defaultAcademicYear,
        franchise_id: franchiseId,
        status: "onboarding",
      });
      if (e) throw e;
      toast.success("School request submitted for onboarding approval.");
      setShowNew(false);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request school.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSchool = async () => {
    if (!editSchool || !formName.trim()) { toast.error("School name is required."); return; }
    setBusy(true);
    try {
      const rpcName = editSchool.status === "rejected" ? "resubmit_school_request" : "update_school_request";
      const { error: e } = await supabase.rpc(rpcName as "update_school_request", {
        _school_id: editSchool.school_id,
        _name: formName.trim(),
        _city: formCity.trim(),
        _state: formState.trim(),
        _address: formAddress.trim(),
        _academic_year: formYear.trim() || defaultAcademicYear,
      });
      if (e) throw e;
      toast.success(editSchool.status === "rejected" ? "School request resubmitted for approval." : "School request updated.");
      setEditSchool(null);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update school.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSchool = async () => {
    if (!cancelSchool) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("cancel_school_request", { _school_id: cancelSchool.school_id });
      if (e) throw e;
      toast.success("School request cancelled and removed.");
      setCancelSchool(null);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel school.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="My Schools" subtitle={scope?.name ?? "Franchise"} actions={!readOnly ? <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Request school</Button> : undefined}>
      <div className="space-y-6">
        {readOnly && <ReadOnlyBanner visible />}
        {preview && <div role="status" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-medium">Preview mode — read-only.</div>}

        {error && (
          <div role="alert" className="surface-panel flex items-center gap-3 p-4 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" /><p className="text-muted-foreground">{error}</p>
          </div>
        )}

        <div className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-1">
              {["All", "Active", "Pending", "Declined", "Suspended"].map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading schools…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-display text-base font-semibold">{q || statusFilter !== "All" ? "No schools match your filter" : "No schools yet"}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{q || statusFilter !== "All" ? "Try adjusting your search or filter." : "Request your first school to get started."}</p>
              {!q && statusFilter === "All" && !readOnly && <Button className="mt-5" onClick={openNew}>Request a school</Button>}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {shown.map((school) => (
                <article key={school.school_id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(220px,1.5fr)_auto_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{school.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{school.code} · {[school.city, school.state].filter(Boolean).join(", ") || "Location not set"}</p>
                    {school.principal_name && <p className="mt-0.5 truncate text-xs text-muted-foreground">Principal: {school.principal_name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={statusTone(school.status)}>{statusLabel(school.status)}</Pill>
                    {school.status === "rejected" && school.decline_reason && (
                      <span className="max-w-[200px] truncate text-xs text-destructive" title={school.decline_reason}>
                        {school.decline_reason}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground">{new Date(school.created_at).toLocaleDateString("en-IN")}</time>
                  <div className="flex flex-wrap gap-2">
                    {school.status === "active" && (
                      <Button variant="outline" size="sm" onClick={() => openSchool(school.school_id)}>Open school <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button>
                    )}
                    {school.status === "onboarding" && !readOnly && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(school)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => setCancelSchool(school)}><XCircle className="mr-1 h-3.5 w-3.5" />Cancel</Button>
                      </>
                    )}
                    {school.status === "rejected" && !readOnly && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(school)}><RefreshCw className="mr-1 h-3.5 w-3.5" />Edit & resubmit</Button>
                    )}
                    <Button variant="ghost" size="sm" asChild><Link href={`/franchise/schools/${school.school_id}`}>Details</Link></Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Request new school dialog */}
        <Dialog open={showNew} onOpenChange={(open) => { if (!busy) setShowNew(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request a new school</DialogTitle>
              <DialogDescription>Submit a school request for Central Admin onboarding approval.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="space-y-1 text-sm"><span className="font-medium">School name *</span><Input value={formName} onChange={(e) => setFormName(e.target.value)} required /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-medium">City</span><Input value={formCity} onChange={(e) => setFormCity(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">State</span><Input value={formState} onChange={(e) => setFormState(e.target.value)} /></label>
              </div>
              <label className="space-y-1 text-sm"><span className="font-medium">Address</span><Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Academic year</span><Input value={formYear} onChange={(e) => setFormYear(e.target.value)} placeholder={defaultAcademicYear} /></label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void handleRequestSchool()} disabled={busy || !formName.trim()}>{busy ? "Submitting…" : "Submit request"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit / resubmit dialog */}
        <Dialog open={!!editSchool} onOpenChange={(open) => { if (!busy && !open) setEditSchool(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editSchool?.status === "rejected" ? "Edit & resubmit school" : "Edit school request"}</DialogTitle>
              <DialogDescription>{editSchool?.status === "rejected" ? "Fix the issues and resubmit for approval." : "Update pending school details."}</DialogDescription>
            </DialogHeader>
            {editSchool?.status === "rejected" && editSchool.decline_reason && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">Decline reason</p>
                <p className="mt-1 text-muted-foreground">{editSchool.decline_reason}</p>
              </div>
            )}
            <div className="grid gap-4">
              <label className="space-y-1 text-sm"><span className="font-medium">School name *</span><Input value={formName} onChange={(e) => setFormName(e.target.value)} required /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-medium">City</span><Input value={formCity} onChange={(e) => setFormCity(e.target.value)} /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">State</span><Input value={formState} onChange={(e) => setFormState(e.target.value)} /></label>
              </div>
              <label className="space-y-1 text-sm"><span className="font-medium">Address</span><Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Academic year</span><Input value={formYear} onChange={(e) => setFormYear(e.target.value)} /></label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSchool(null)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void handleUpdateSchool()} disabled={busy || !formName.trim()}>{busy ? "Saving…" : editSchool?.status === "rejected" ? "Resubmit" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel confirmation */}
        <ConfirmDialog
          open={!!cancelSchool}
          onOpenChange={(open) => { if (!open) setCancelSchool(null); }}
          title="Cancel school request"
          description={`This will permanently delete the school request "${cancelSchool?.name}". This cannot be undone.`}
          confirmLabel="Cancel request"
          destructive
          busy={busy}
          onConfirm={handleCancelSchool}
        />
      </div>
    </AppShell>
  );
}
