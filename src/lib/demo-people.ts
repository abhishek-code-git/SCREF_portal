/** DEMO DATA — illustrative records for the prototype only. */

export type Student = {
  id: string;
  name: string;
  klass: string;
  section: string;
  roll: number;
  parent: string;
  phone: string;
  attendance: number;
  fee: "Paid" | "Pending" | "Overdue";
  transport: string;
  status: "Active" | "Transfer requested";
};

const first = ["Aarav", "Ishita", "Kabir", "Myra", "Reyansh", "Anaya", "Vihaan", "Saanvi", "Arjun", "Diya", "Advait", "Kiara", "Ayaan", "Navya", "Shaurya", "Tara"];
const last = ["Sharma", "Verma", "Nanda", "Joshi", "Gupta", "Mehta", "Yadav", "Kapoor", "Singh", "Chauhan", "Malhotra", "Bansal", "Agarwal", "Rathore", "Saini", "Khanna"];
const fathers = ["Rohit", "Amit", "Sanjay", "Vivek", "Manish", "Deepak", "Rakesh", "Anil", "Sunil", "Gaurav", "Pankaj", "Nitin", "Ajay", "Vikas", "Rajesh", "Harish"];

export const students: Student[] = first.map((f, i) => ({
  id: `TCS-${2026}${String(101 + i * 7).padStart(4, "0")}`,
  name: `${f} ${last[i]}`,
  klass: String((i % 12) + 1),
  section: ["A", "B", "C"][i % 3]!,
  roll: 3 + i * 2,
  parent: `${fathers[i]} ${last[i]}`,
  phone: `+91 98${String(10023456 + i * 13791).slice(0, 8)}`,
  attendance: Number((86 + ((i * 37) % 13) + 0.4).toFixed(1)),
  fee: i % 5 === 2 ? "Pending" : i % 7 === 4 ? "Overdue" : "Paid",
  transport: i % 3 === 0 ? `Route ${(i % 14) + 1}` : "—",
  status: i === 9 ? "Transfer requested" : "Active",
}));

export type Staff = {
  name: string;
  designation: string;
  department: string;
  phone: string;
  attendance: number;
  joined: string;
  status: "Present" | "On leave" | "Absent";
  type: "Teaching" | "Administrative" | "Support";
};

export const staff: Staff[] = [
  { name: "Dr. Meenakshi Rawat", designation: "Principal", department: "Leadership", phone: "+91 98290 11420", attendance: 98, joined: "Apr 2019", status: "Present", type: "Administrative" },
  { name: "Pooja Bhardwaj", designation: "Academic Coordinator", department: "Academics", phone: "+91 99280 44120", attendance: 96, joined: "Jun 2020", status: "Present", type: "Teaching" },
  { name: "Ramesh Kumar", designation: "PGT Physics", department: "Science", phone: "+91 98113 22091", attendance: 94, joined: "Jul 2018", status: "Present", type: "Teaching" },
  { name: "Neelam Arora", designation: "TGT English", department: "Languages", phone: "+91 97170 55302", attendance: 92, joined: "Apr 2021", status: "On leave", type: "Teaching" },
  { name: "Sandeep Tanwar", designation: "PGT Mathematics", department: "Mathematics", phone: "+91 98720 66118", attendance: 97, joined: "Apr 2017", status: "Present", type: "Teaching" },
  { name: "Kavita Sehgal", designation: "PRT", department: "Primary", phone: "+91 99110 77824", attendance: 95, joined: "Jul 2022", status: "Present", type: "Teaching" },
  { name: "Anil Choudhary", designation: "Accounts Officer", department: "Finance", phone: "+91 98290 88533", attendance: 99, joined: "Apr 2019", status: "Present", type: "Administrative" },
  { name: "Suman Devi", designation: "Front Office Executive", department: "Administration", phone: "+91 98871 99240", attendance: 93, joined: "Jan 2023", status: "Present", type: "Administrative" },
  { name: "Mahesh Yadav", designation: "Transport Supervisor", department: "Transport", phone: "+91 97830 10456", attendance: 91, joined: "Apr 2020", status: "Absent", type: "Support" },
  { name: "Geeta Rani", designation: "Lab Assistant", department: "Science", phone: "+91 98290 21678", attendance: 94, joined: "Aug 2021", status: "Present", type: "Support" },
];

export type Lead = {
  child: string;
  parent: string;
  phone: string;
  email: string;
  klass: string;
  source: string;
  stage: string;
  assigned: string;
  followUp: string;
};

export const stages = ["New Enquiry", "Contacted", "Visit Scheduled", "Application", "Documentation", "Admission Confirmed"];

export const leads: Lead[] = [
  { child: "Riya Malik", parent: "Sonia Malik", phone: "+91 98110 22314", email: "sonia.malik@gmail.com", klass: "Nursery", source: "Website", stage: "New Enquiry", assigned: "Suman Devi", followUp: "02 Oct" },
  { child: "Om Prakash", parent: "Jitender Prakash", phone: "+91 99280 11873", email: "jitender.p@gmail.com", klass: "Class 3", source: "Walk-in", stage: "New Enquiry", assigned: "Suman Devi", followUp: "02 Oct" },
  { child: "Aadhya Jain", parent: "Neha Jain", phone: "+91 97170 33420", email: "neha.jain@outlook.com", klass: "Class 1", source: "Referral", stage: "Contacted", assigned: "Pooja Bhardwaj", followUp: "03 Oct" },
  { child: "Krish Goyal", parent: "Mukesh Goyal", phone: "+91 98290 44561", email: "mgoyal@gmail.com", klass: "Class 6", source: "Facebook", stage: "Contacted", assigned: "Suman Devi", followUp: "04 Oct" },
  { child: "Pihu Sethi", parent: "Ritu Sethi", phone: "+91 98720 55602", email: "ritu.sethi@gmail.com", klass: "LKG", source: "Website", stage: "Visit Scheduled", assigned: "Pooja Bhardwaj", followUp: "05 Oct" },
  { child: "Yash Rathi", parent: "Arun Rathi", phone: "+91 99110 66713", email: "arun.rathi@gmail.com", klass: "Class 9", source: "Hoarding", stage: "Application", assigned: "Suman Devi", followUp: "03 Oct" },
  { child: "Avni Tyagi", parent: "Shalini Tyagi", phone: "+91 98871 77824", email: "shalini.t@gmail.com", klass: "Class 4", source: "Referral", stage: "Documentation", assigned: "Pooja Bhardwaj", followUp: "02 Oct" },
  { child: "Dev Khurana", parent: "Rahul Khurana", phone: "+91 97830 88935", email: "rkhurana@gmail.com", klass: "Class 11", source: "Website", stage: "Admission Confirmed", assigned: "Suman Devi", followUp: "—" },
];
