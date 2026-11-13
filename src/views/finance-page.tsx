"use client";

import { Download, FileText, Receipt } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, DemoBadge } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { collectionTrend, feeCategories } from "@/lib/demo-data";

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const transactions = [
  ["TXN-40921", "Aarav Sharma · Class 5-A", "Tuition · Q2", "₹18,500", "Paid"],
  ["TXN-40922", "Ishita Verma · Class 9-B", "Tuition + Transport", "₹24,300", "Paid"],
  ["TXN-40923", "Kabir Nanda · Class 2-C", "Tuition · Q2", "₹16,200", "Pending"],
  ["TXN-40924", "Myra Joshi · Class 11-A", "Examination", "₹3,800", "Paid"],
  ["TXN-40925", "Reyansh Gupta · Class 7-B", "Tuition · Q2", "₹19,100", "Overdue"],
];

export function FinancePage() {
  return (
    <AppShell
      title="Finance"
      subtitle="Collection, pending fees, expenses and revenue for this centre."
      actions={<DemoBadge />}
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Collection" value={18.4} format="lakh" delta="82% of target" tone="up" />
          <MetricCard label="Pending Fees" value={4.1} format="lakh" delta="62 families" tone="down" />
          <MetricCard label="Overdue" value={1.3} format="lakh" delta="21 families" tone="down" />
          <MetricCard label="Net This Month" value={7.2} format="lakh" delta="After ₹11.2L expenses" tone="up" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="surface-panel p-5">
            <p className="text-sm font-semibold">Revenue vs expenses</p>
            <p className="text-xs text-muted-foreground">In lakh rupees, current academic year</p>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={collectionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="collected" name="Collected" stroke="var(--chart-1)" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-2)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-panel p-5">
            <p className="text-sm font-semibold">Fee category distribution</p>
            <p className="text-xs text-muted-foreground">Share of total collection</p>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feeCategories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {feeCategories.map((entry, i) => (
                      <Cell key={entry.name} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="surface-panel p-5">
          <p className="text-sm font-semibold">Monthly collection vs pending</p>
          <div className="mt-5 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="collected" name="Collected" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <p className="text-sm font-semibold">Recent transactions</p>
              <p className="text-xs text-muted-foreground">Last updated 10 minutes ago</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Receipt className="mr-2 h-4 w-4" /> View all
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button size="sm">
                <FileText className="mr-2 h-4 w-4" /> Generate report
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Transaction</th>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(([id, student, category, amount, status]) => (
                  <tr key={id} className="border-t border-border transition-colors hover:bg-surface">
                    <td className="px-5 py-3 font-medium">{id}</td>
                    <td className="px-5 py-3 text-muted-foreground">{student}</td>
                    <td className="px-5 py-3 text-muted-foreground">{category}</td>
                    <td className="px-5 py-3 tabular-nums">{amount}</td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          status === "Paid"
                            ? "rounded-full bg-navy-soft px-2.5 py-1 text-[11px] font-semibold text-navy"
                            : status === "Pending"
                              ? "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                              : "rounded-full bg-crimson-soft px-2.5 py-1 text-[11px] font-semibold text-destructive"
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
