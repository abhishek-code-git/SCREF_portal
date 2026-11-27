"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Field, Panel, ReadOnlyBanner } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFranchiseScope } from "@/hooks/use-franchise";
import { supabase } from "@/integrations/supabase/client";

type NetSetting = { setting_key: string; setting_value: string };

export function FranchiseSettingsPage() {
  const { franchiseId, readOnly, preview, loading: ctxLoading, error: ctxError, scope, ownedMeta, refresh } = useFranchiseScope();

  const settingsQuery = useQuery<NetSetting[], Error>({
    queryKey: ["franchise-network-settings"],
    queryFn: async () => {
      const { data, error: e } = await supabase.from("network_settings").select("setting_key,setting_value").in("setting_key", ["network_name", "support_email", "support_phone"]);
      if (e) throw e;
      return (data ?? []) as NetSetting[];
    },
  });
  const getNet = (key: string) => settingsQuery.data?.find((s) => s.setting_key === key)?.setting_value ?? "";

  const [phone, setPhone] = useState(ownedMeta?.phone ?? "");
  const [email, setEmail] = useState(ownedMeta?.email ?? "");
  const [address, setAddress] = useState(ownedMeta?.address ?? "");
  const [city, setCity] = useState(ownedMeta?.city ?? "");
  const [state, setState] = useState(ownedMeta?.state ?? "");
  const [ownerName, setOwnerName] = useState(ownedMeta?.owner_name ?? "");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (ownedMeta && !loaded) {
    setPhone(ownedMeta.phone); setEmail(ownedMeta.email);
    setAddress(ownedMeta.address); setCity(ownedMeta.city);
    setState(ownedMeta.state); setOwnerName(ownedMeta.owner_name);
    setLoaded(true);
  }

  const handleSave = async () => {
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("update_franchise_contact", {
        _franchise_id: franchiseId,
        _phone: phone.trim(),
        _email: email.trim(),
        _address: address.trim(),
        _city: city.trim(),
        _state: state.trim(),
        _owner_name: ownerName.trim(),
      });
      if (e) throw e;
      toast.success("Franchise contact updated.");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const loading = ctxLoading;

  return (
    <AppShell title="Franchise Settings" subtitle={scope?.name ?? "Franchise"}>
      <div className="space-y-6">
        {readOnly && <ReadOnlyBanner visible />}
        {preview && <div role="status" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-medium">Preview mode — read-only.</div>}
        {ctxError && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{ctxError}</div>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        ) : (
          <>
            <Panel title="Franchise identity" subtitle="These fields are set by Central Admin and cannot be changed here.">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-2"><Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><Field label="Franchise Code" value={ownedMeta?.code ?? scope?.name ?? "—"} /></div>
                <div className="flex items-start gap-2"><Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><Field label="Status" value={scope?.status ?? ownedMeta?.status ?? "—"} /></div>
                <div className="flex items-start gap-2"><Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><Field label="Territory" value={ownedMeta?.territory ?? "Not assigned"} /></div>
                <div className="flex items-start gap-2"><Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><Field label="Master Franchise" value={ownedMeta?.master_name ?? scope?.master_status ?? "—"} /></div>
              </div>
            </Panel>

            <Panel title="Contact details" subtitle={readOnly ? "Read-only while your franchise is inactive." : "Update your franchise contact information."}>
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm"><span className="font-medium">Owner name</span><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={readOnly} /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">Phone</span><Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} /></label>
                </div>
                <label className="space-y-1 text-sm"><span className="font-medium">Email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={readOnly} /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Address</span><Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={readOnly} /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm"><span className="font-medium">City</span><Input value={city} onChange={(e) => setCity(e.target.value)} disabled={readOnly} /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">State</span><Input value={state} onChange={(e) => setState(e.target.value)} disabled={readOnly} /></label>
                </div>
                {!readOnly && (
                  <div className="flex justify-end">
                    <Button onClick={() => void handleSave()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Brand support" subtitle="Central network contact information.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Network" value={getNet("network_name") || "The Centennial Network"} />
                <Field label="Support email" value={getNet("support_email") || "—"} />
                <Field label="Support phone" value={getNet("support_phone") || "—"} />
              </div>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
