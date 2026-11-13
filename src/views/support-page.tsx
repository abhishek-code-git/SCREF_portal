"use client";

import { LifeBuoy, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill } from "@/components/kit";
import { SignInGate } from "@/components/sign-in-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Ticket = { id: string; subject: string; category: string; priority: string; status: string; created_at: string };

function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTickets(data);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("support_tickets").insert({ subject, category, priority, message });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket raised with head office");
    setSubject("");
    setMessage("");
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Panel title="Raise a ticket">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Choice label="Category" value={category} set={setCategory} opts={["General", "Finance", "Technical", "Admissions", "Transport"]} />
            <Choice label="Priority" value={priority} set={setPriority} opts={["Low", "Normal", "High", "Urgent"]} />
          </div>
          <div className="space-y-1.5">
            <Label>Describe the issue</Label>
            <Textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Submitting…" : "Submit ticket"}
          </Button>
        </form>
      </Panel>
      <Panel title="My tickets" subtitle={`${tickets.length} total`}>
        {tickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3">
                <div>
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {t.priority} · {new Date(t.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Pill tone={t.status === "Open" ? "red" : "navy"}>{t.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function Choice({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {opts.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function SupportPage() {
  return (
    <AppShell title="Support" subtitle="Help from Centennial head office.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [Phone, "Helpline", "+91 1800 120 2026 · 9am–6pm"],
            [Mail, "Email", "support@centennial.school"],
            [LifeBuoy, "Response time", "Within 4 working hours"],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Phone;
            return (
              <div key={t as string} className="surface-panel flex items-center gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-soft text-navy">
                  <I className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t as string}</p>
                  <p className="text-xs text-muted-foreground">{d as string}</p>
                </div>
              </div>
            );
          })}
        </div>
        <SignInGate>
          <Tickets />
        </SignInGate>
      </div>
    </AppShell>
  );
}
