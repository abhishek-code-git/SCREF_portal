/**
 * DEMO DATA — prototype only.
 * Every value here is illustrative sample data for the Centennial portal
 * prototype. Replace with API/database reads when backend systems connect.
 */

export const IS_DEMO_DATA = true;

export type Centre = {
  id: string;
  code: string;
  name: string;
  city: string;
  principal: string;
  owner: string;
  students: number;
  staff: number;
  teachers: number;
  admissions: number;
  attendance: number;
  collectionLakh: number;
  collectedPct: number;
  status: "Active" | "Onboarding" | "Review";
};

export const centres: Centre[] = [
  {
    id: "c-001",
    code: "CEN-001",
    name: "The Centennial School – Bhiwadi",
    city: "Bhiwadi, Rajasthan",
    principal: "Dr. Meenakshi Rawat",
    owner: "Rajeev Chaudhary",
    students: 1248,
    staff: 96,
    teachers: 72,
    admissions: 142,
    attendance: 93.4,
    collectionLakh: 18.4,
    collectedPct: 82,
    status: "Active",
  },
  {
    id: "c-002",
    code: "CEN-002",
    name: "The Centennial School – Noida",
    city: "Noida, Uttar Pradesh",
    principal: "Sunita Bahl",
    owner: "Aarti Mehrotra",
    students: 1586,
    staff: 118,
    teachers: 88,
    admissions: 176,
    attendance: 91.8,
    collectionLakh: 24.1,
    collectedPct: 78,
    status: "Active",
  },
  {
    id: "c-003",
    code: "CEN-003",
    name: "The Centennial School – Lajpat Nagar",
    city: "New Delhi",
    principal: "Vikram Anand",
    owner: "S. K. Bhatia",
    students: 964,
    staff: 74,
    teachers: 56,
    admissions: 98,
    attendance: 94.6,
    collectionLakh: 15.2,
    collectedPct: 86,
    status: "Active",
  },
  {
    id: "c-004",
    code: "CEN-004",
    name: "The Centennial School – Sarita Vihar",
    city: "New Delhi",
    principal: "Nandini Iyer",
    owner: "Praveen Saxena",
    students: 812,
    staff: 63,
    teachers: 47,
    admissions: 121,
    attendance: 90.2,
    collectionLakh: 11.8,
    collectedPct: 71,
    status: "Review",
  },
  {
    id: "c-005",
    code: "CEN-005",
    name: "The Centennial School – Jaipur South",
    city: "Jaipur, Rajasthan",
    principal: "Harshit Trivedi",
    owner: "Neha Ranawat",
    students: 402,
    staff: 41,
    teachers: 29,
    admissions: 64,
    attendance: 92.1,
    collectionLakh: 6.3,
    collectedPct: 68,
    status: "Onboarding",
  },
];

export const activeCentre = centres[0]!;

export const currentUser = {
  name: "Rajeev Chaudhary",
  role: "Owner / Franchisee",
  email: "rajeev.chaudhary@centennial.edu.in",
  lastLogin: "Today, 08:42 AM",
};

export const kpis = [
  { label: "Total Students", value: 1248, format: "number", delta: "+8.4% this year", tone: "up" },
  { label: "Fee Collection", value: 18.4, format: "lakh", delta: "82% collected", tone: "up" },
  { label: "Total Staff", value: 96, format: "number", delta: "89 active today", tone: "flat" },
  { label: "Attendance Today", value: 93.4, format: "percent", delta: "Above 90% target", tone: "up" },
  { label: "New Admissions", value: 142, format: "number", delta: "+24 this month", tone: "up" },
  { label: "Pending Fees", value: 4.1, format: "lakh", delta: "62 families", tone: "down" },
  { label: "Transport Students", value: 384, format: "number", delta: "14 routes", tone: "flat" },
  { label: "Open Enquiries", value: 58, format: "number", delta: "19 awaiting follow-up", tone: "flat" },
] as const;

export const studentGrowth = [
  { month: "Apr", students: 1118, admissions: 22 },
  { month: "May", students: 1141, admissions: 26 },
  { month: "Jun", students: 1174, admissions: 34 },
  { month: "Jul", students: 1196, admissions: 24 },
  { month: "Aug", students: 1214, admissions: 18 },
  { month: "Sep", students: 1248, admissions: 18 },
];

export const collectionTrend = [
  { month: "Apr", collected: 14.2, pending: 3.1, expenses: 9.4 },
  { month: "May", collected: 15.8, pending: 2.8, expenses: 9.9 },
  { month: "Jun", collected: 17.1, pending: 3.6, expenses: 10.4 },
  { month: "Jul", collected: 16.4, pending: 4.4, expenses: 10.1 },
  { month: "Aug", collected: 17.9, pending: 3.9, expenses: 10.8 },
  { month: "Sep", collected: 18.4, pending: 4.1, expenses: 11.2 },
];

export const feeCategories = [
  { name: "Tuition", value: 62 },
  { name: "Transport", value: 17 },
  { name: "Activity", value: 11 },
  { name: "Examination", value: 6 },
  { name: "Other", value: 4 },
];

export const attendanceByClass = [
  { klass: "Nursery–UKG", present: 96.1 },
  { klass: "Class 1–3", present: 94.3 },
  { klass: "Class 4–6", present: 93.8 },
  { klass: "Class 7–8", present: 92.4 },
  { klass: "Class 9–10", present: 91.2 },
  { klass: "Class 11–12", present: 90.6 },
];

export const attendanceToday = {
  students: { present: 1166, absent: 62, late: 20, leave: 14, total: 1248 },
  teachers: { present: 68, absent: 2, late: 1, leave: 2, total: 72 },
  staff: { present: 89, absent: 3, late: 2, leave: 4, total: 96 },
};

export const admissionsPipeline = [
  { stage: "New Enquiry", count: 58 },
  { stage: "Contacted", count: 41 },
  { stage: "Visit Scheduled", count: 26 },
  { stage: "Application", count: 19 },
  { stage: "Documentation", count: 12 },
  { stage: "Confirmed", count: 9 },
];

export const announcements = [
  {
    title: "Half-yearly examination schedule released",
    audience: "Parents · Classes 6–10",
    status: "Sent",
    date: "24 Sep 2026",
  },
  {
    title: "Transport route 7 timing revision",
    audience: "Parents · Route 7",
    status: "Scheduled",
    date: "28 Sep 2026",
  },
  {
    title: "Staff development workshop",
    audience: "Teachers · All departments",
    status: "Draft",
    date: "—",
  },
  {
    title: "Fee reminder — Quarter 2",
    audience: "Parents · Pending payments",
    status: "Sent",
    date: "18 Sep 2026",
  },
];

export const notifications = [
  { text: "Fee collection reached 82% of the monthly target.", tone: "success", time: "2h ago" },
  { text: "3 students have incomplete admission documents.", tone: "warning", time: "5h ago" },
  { text: "Transport system integration requires attention.", tone: "warning", time: "Yesterday" },
  { text: "Academic results for Class 10 are ready to review.", tone: "info", time: "Yesterday" },
];

export const reportCategories = [
  { name: "Student Reports", desc: "Enrolment, class strength, profiles and transfers", count: 8 },
  { name: "Attendance Reports", desc: "Daily, monthly and class-wise attendance", count: 6 },
  { name: "Academic Reports", desc: "Examination trends and class performance", count: 7 },
  { name: "Finance Reports", desc: "Collection, pending, expenses and revenue", count: 9 },
  { name: "Admissions Reports", desc: "Enquiry sources, conversion and pipeline", count: 5 },
  { name: "Staff Reports", desc: "Attendance, leave, payroll summary", count: 6 },
  { name: "Transport Reports", desc: "Routes, vehicles and transport usage", count: 4 },
];

export const transportSummary = {
  connected: false,
  vehicles: 14,
  routes: 14,
  students: 384,
  drivers: 16,
};

export const currency = (lakh: number) => `₹${lakh.toFixed(1)}L`;
