"use client";

import { Bus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, StatGrid } from "@/components/kit";

export function TransportPage() {
  return (
    <AppShell title="Transport" subtitle="Transport system connection pending.">
      <div className="space-y-6">
        <StatGrid
          items={[
            ["Routes", "—", "No live data available"],
            ["Buses", "—", "No live data available"],
            ["Students using transport", "—", "No live data available"],
            ["Live tracking", "Off", "Requires transport system"],
          ]}
        />
        <EmptyState
          icon={<Bus className="h-5 w-5" />}
          title="Transport system not connected"
          text="Live bus locations, routes and pickup status appear here once your transport system is connected. We never show estimated or simulated locations."
          cta="Connect transport system"
        />
        <Panel title="What you'll get after connecting">
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>• Route and stop list</li>
            <li>• Bus and driver details</li>
            <li>• Live location from the transport provider</li>
            <li>• Pickup and drop alerts to parents</li>
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
