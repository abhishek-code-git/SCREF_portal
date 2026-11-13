"use client";

import { CalendarClock, Save, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { announcements } from "@/lib/demo-data";

export function CommunicationPage() {
  const [message, setMessage] = useState("");

  return (
    <AppShell
      title="Communication Centre"
      subtitle="Announcements, notifications, SMS and email for your centre."
      actions={<DemoBadge />}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="surface-panel p-5">
          <p className="text-sm font-semibold">New announcement</p>
          <p className="text-xs text-muted-foreground">
            Choose an audience, write the notice and send or schedule it.
          </p>

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select defaultValue="parents">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parents">Parents</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                    <SelectItem value="teachers">Teachers</SelectItem>
                    <SelectItem value="staff">All staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    <SelectItem value="primary">Nursery – Class 5</SelectItem>
                    <SelectItem value="middle">Class 6 – 8</SelectItem>
                    <SelectItem value="senior">Class 9 – 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="msg">Message</Label>
              <Textarea
                id="msg"
                rows={7}
                placeholder="Write announcement…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Delivered through in-app notification, SMS and email.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => toast.success("Draft saved")}>
                <Save className="mr-2 h-4 w-4" /> Save draft
              </Button>
              <Button variant="outline" onClick={() => toast.success("Announcement scheduled")}>
                <CalendarClock className="mr-2 h-4 w-4" /> Schedule
              </Button>
              <Button
                onClick={() =>
                  message.trim()
                    ? toast.success("Announcement sent to selected audience")
                    : toast.error("Write a message first")
                }
              >
                <Send className="mr-2 h-4 w-4" /> Send
              </Button>
            </div>
          </div>
        </section>

        <section className="surface-panel overflow-hidden">
          <div className="border-b border-border p-5">
            <p className="text-sm font-semibold">Recent communication</p>
            <p className="text-xs text-muted-foreground">Sent, scheduled and drafted notices</p>
          </div>
          <ul className="divide-y divide-border">
            {announcements.map((a) => (
              <li key={a.title} className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.audience}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.date}</p>
                </div>
                <span
                  className={
                    a.status === "Sent"
                      ? "shrink-0 rounded-full bg-navy-soft px-2.5 py-1 text-[11px] font-semibold text-navy"
                      : a.status === "Scheduled"
                        ? "shrink-0 rounded-full bg-crimson-soft px-2.5 py-1 text-[11px] font-semibold text-destructive"
                        : "shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                  }
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
