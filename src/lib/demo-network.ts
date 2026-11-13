/**
 * DEMO-ONLY hierarchy fixture.
 *
 * This is fictional presentation data. It is never a source for authenticated
 * dashboards, Supabase queries, login, or role assignment.
 */
export type DemoStudent = {
  id: string;
  name: string;
  className: string;
  status: "Active" | "Pending";
};

export type DemoSchool = {
  id: string;
  name: string;
  city: string;
  status: "Active" | "Onboarding" | "Inactive";
  academicYear: string;
  principal: { id: string; name: string; email: string };
  teachers: { id: string; name: string; subject: string }[];
  students: DemoStudent[];
  classes: string[];
  attendance: { present: number; total: number };
  onboardingTasks: string[];
};

export type DemoFranchise = {
  id: string;
  name: string;
  territory: string;
  schools: DemoSchool[];
};

export type DemoMasterFranchise = {
  id: string;
  name: string;
  owner: { id: string; name: string; email: string };
  territories: string[];
  franchises: DemoFranchise[];
};

export const demoNetwork: {
  superAdmin: { id: string; name: string; email: string };
  masterFranchises: DemoMasterFranchise[];
} = {
  superAdmin: { id: "demo-super-admin", name: "Demo Super Admin", email: "super-admin@example.test" },
  masterFranchises: [
    {
      id: "demo-mf-west",
      name: "Western Learning Network",
      owner: { id: "demo-owner-west", name: "Aarav Mehta", email: "aarav.mehta@example.test" },
      territories: ["Gujarat", "Rajasthan"],
      franchises: [
        {
          id: "demo-fr-gujarat",
          name: "Gujarat Central Franchise",
          territory: "Gujarat",
          schools: [
            {
              id: "demo-school-vadodara",
              name: "Centennial Vadodara",
              city: "Vadodara",
              status: "Active",
              academicYear: "2026–27",
              principal: { id: "demo-principal-vadodara", name: "Mira Shah", email: "mira.shah@example.test" },
              teachers: [
                { id: "demo-teacher-kavya", name: "Kavya Desai", subject: "Mathematics" },
                { id: "demo-teacher-isha", name: "Isha Patel", subject: "Science" },
              ],
              students: [
                { id: "demo-student-101", name: "Anaya Joshi", className: "Class 5 A", status: "Active" },
                { id: "demo-student-102", name: "Kabir Shah", className: "Class 5 A", status: "Active" },
                { id: "demo-student-103", name: "Tara Mehta", className: "Class 3 B", status: "Pending" },
              ],
              classes: ["Class 3 B", "Class 5 A"],
              attendance: { present: 42, total: 46 },
              onboardingTasks: [],
            },
            {
              id: "demo-school-ahmedabad",
              name: "Centennial Ahmedabad North",
              city: "Ahmedabad",
              status: "Onboarding",
              academicYear: "2026–27",
              principal: { id: "demo-principal-ahmedabad", name: "Devika Rao", email: "devika.rao@example.test" },
              teachers: [
                { id: "demo-teacher-kavya", name: "Kavya Desai", subject: "Mathematics" },
                { id: "demo-teacher-neel", name: "Neel Trivedi", subject: "English" },
              ],
              students: [
                { id: "demo-student-201", name: "Riya Patel", className: "Class 2 A", status: "Active" },
                { id: "demo-student-202", name: "Vivaan Shah", className: "Class 4 A", status: "Pending" },
              ],
              classes: ["Class 2 A", "Class 4 A"],
              attendance: { present: 0, total: 0 },
              onboardingTasks: ["Confirm school contact details", "Complete principal orientation"],
            },
          ],
        },
        {
          id: "demo-fr-rajasthan",
          name: "Rajasthan South Franchise",
          territory: "Rajasthan",
          schools: [
            {
              id: "demo-school-udaipur",
              name: "Centennial Udaipur",
              city: "Udaipur",
              status: "Inactive",
              academicYear: "2026–27",
              principal: { id: "demo-principal-udaipur", name: "Rohan Sethi", email: "rohan.sethi@example.test" },
              teachers: [{ id: "demo-teacher-sana", name: "Sana Khan", subject: "Social Studies" }],
              students: [
                { id: "demo-student-301", name: "Aarav Singh", className: "Class 6 A", status: "Active" },
                { id: "demo-student-302", name: "Myra Jain", className: "Class 1 A", status: "Active" },
              ],
              classes: ["Class 1 A", "Class 6 A"],
              attendance: { present: 0, total: 0 },
              onboardingTasks: [],
            },
          ],
        },
      ],
    },
    {
      id: "demo-mf-south",
      name: "Southern Learning Network",
      owner: { id: "demo-owner-south", name: "Nila Krishnan", email: "nila.krishnan@example.test" },
      territories: ["Karnataka"],
      franchises: [
        {
          id: "demo-fr-bengaluru",
          name: "Bengaluru East Franchise",
          territory: "Karnataka",
          schools: [
            {
              id: "demo-school-bengaluru",
              name: "Centennial Bengaluru East",
              city: "Bengaluru",
              status: "Active",
              academicYear: "2026–27",
              principal: { id: "demo-principal-bengaluru", name: "Aditi Nair", email: "aditi.nair@example.test" },
              teachers: [{ id: "demo-teacher-arjun", name: "Arjun Rao", subject: "Computer Science" }],
              students: [
                { id: "demo-student-401", name: "Ira Menon", className: "Class 7 A", status: "Active" },
                { id: "demo-student-402", name: "Reyansh Iyer", className: "Class 7 A", status: "Active" },
              ],
              classes: ["Class 7 A"],
              attendance: { present: 28, total: 30 },
              onboardingTasks: [],
            },
          ],
        },
      ],
    },
  ],
};

export const allDemoSchools = demoNetwork.masterFranchises.flatMap((master) =>
  master.franchises.flatMap((franchise) => franchise.schools),
);

export const demoNetworkTotals = {
  masterFranchises: demoNetwork.masterFranchises.length,
  franchises: demoNetwork.masterFranchises.reduce((total, master) => total + master.franchises.length, 0),
  schools: allDemoSchools.length,
  activeSchools: allDemoSchools.filter((school) => school.status === "Active").length,
  pendingSchools: allDemoSchools.filter((school) => school.status === "Onboarding").length,
  inactiveSchools: allDemoSchools.filter((school) => school.status === "Inactive").length,
  students: new Set(allDemoSchools.flatMap((school) => school.students.map((student) => student.id))).size,
  teachers: new Set(allDemoSchools.flatMap((school) => school.teachers.map((teacher) => teacher.id))).size,
  principals: new Set(allDemoSchools.map((school) => school.principal.id)).size,
};
