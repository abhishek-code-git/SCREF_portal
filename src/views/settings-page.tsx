"use client";

import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { activeCentre, currentUser } from "@/lib/demo-data";

function Row({ label, def }: { label: string; def: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={def} />
    </div>
  );
}

export function SettingsPage() {
  const save = () => toast.success("Settings saved");
  return (
    <AppShell title="Settings" subtitle="Centre profile, account and security.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Centre profile" action={<Button size="sm" onClick={save}>Save</Button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Centre name" def={`The Centennial School, ${activeCentre.name}`} />
            <Row label="Centre ID" def={activeCentre.id} />
            <Row label="City" def={activeCentre.city} />
            <Row label="Academic year" def="2026–27" />
          </div>
        </Panel>
        <Panel title="My account" action={<Button size="sm" onClick={save}>Save</Button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Full name" def={currentUser.name} />
            <Row label="Role" def={currentUser.role} />
            <Row label="Email" def="owner@centennial.school" />
            <Row label="Phone" def="+91 98290 00000" />
          </div>
        </Panel>
        <Panel title="Notifications">
          {["Fee collection summary (daily)", "Low attendance alerts", "New admission enquiries", "Parent requests"].map((n) => (
            <div key={n} className="flex items-center justify-between border-b border-border py-3 last:border-0">
              <span className="text-sm">{n}</span>
              <Switch defaultChecked onCheckedChange={save} />
            </div>
          ))}
        </Panel>
        <Panel title="Security & access">
          {["Two-step verification", "Sign-out on inactivity (30 min)", "Login alerts by email"].map((n, i) => (
            <div key={n} className="flex items-center justify-between border-b border-border py-3 last:border-0">
              <span className="text-sm">{n}</span>
              <Switch defaultChecked={i > 0} onCheckedChange={save} />
            </div>
          ))}
          <Button variant="outline" className="mt-4" onClick={() => toast.success("Password reset link sent")}>
            Change password
          </Button>
        </Panel>
      </div>
    </AppShell>
  );
}
