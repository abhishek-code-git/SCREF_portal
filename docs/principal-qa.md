# Principal Dashboard Manual QA Script (~20 Minutes)

Run every step in order against a live Supabase project where all migrations through `20261124000002_principal_finalization.sql` have been applied.

## Part A — Network Setup & Principal Onboarding

1. **Create school and principal (as Central Admin)**
   - Sign in as `central_super_admin`, go to `/admin/schools`, create an **active** school (e.g., `Centennial Model Campus`).
   - Go to `/admin/users`, invite a new user with role `School Principal` scoped to that school.
   - **Expected result:** School is created with a `CEN-####` code and `active` status. Principal receives an invite email and sets their password via `/reset-password`.

2. **Principal login & Overview**
   - Sign in as the new principal.
   - **Expected result:** Lands automatically on `/principal` (not `/dashboard`). Left sidebar shows exactly 11 items: Overview, Classes & Timetable, Students, Teachers & Staff, Attendance, Exams & Results, Notices, Admissions, Reports, Settings, Support. Zero demo badges or prototype pages.

## Part B — Classes, Subjects, Timetable & Staff

3. **Set up classes and subjects**
   - Open `/classes`. Create `Class 1` Section `A` and `Class 2` Section `A`.
   - Switch to **Subjects** tab and add `Mathematics` (`MATH`) and `English` (`ENG`).
   - **Expected result:** Classes and subjects persist across reload and appear immediately in Overview counts.

4. **Invite a teacher & assign class + timetable**
   - Open `/staff`, invite a teacher (`teacher@example.com`, role `Teacher`).
   - Return to `/classes`, assign the teacher as Class Teacher for `Class 1-A`, and in **Timetable** add Period 1 on Mon (`08:30`–`09:15`, `Mathematics`) for that teacher.
   - **Expected result:** Teacher shows in `/staff` with `Class 1-A (Class teacher)`. Timetable grid renders Period 1 on Monday. Overview "Needs attention" clears the missing class teacher / missing timetable items for `Class 1-A`.

## Part C — Students (Form + CSV Import)

5. **Admit a student by form**
   - Open `/students`, click **Add student**, fill `Rohan Verma`, `Class 1-A`, roll `1`, parent/guardian details, gender `male`, DOB `2017-04-10`, leave Admission No blank.
   - **Expected result:** Student is saved and automatically assigned `ADM-000001`. Clicking the student opens `/students/[id]` with profile, guardian details, 30/90-day attendance summary, and published marks.

6. **Import students by CSV (with one bad row test)**
   - Click **Import CSV** on `/students` and paste:
     ```csv
     full_name,class,roll_no,gender,date_of_birth,parent_name,parent_phone
     Rohan Verma,Class 1-A,1,male,2017-04-10,Suresh Verma,+91 98000 00001
     Ananya Singh,Class 1-A,2,female,2017-08-22,Priya Singh,+91 98000 00002
     Bad Student,Unknown Class,0,invalid,2017-99-99,Parent,+91 98000 00003
     ```
   - Click **Validate & import**.
   - **Expected result:** Validation catches row 4 errors (`Unknown Class`, `roll_no`, `gender`, `date_of_birth`) and refuses partial import (`Ananya Singh` is NOT imported yet).
   - Remove the bad row (leaving `Rohan Verma` duplicate + `Ananya Singh` new) and click **Validate & import**.
   - **Expected result:** Reports `Imported 1 student(s), skipped 1 duplicate(s).` `Ananya Singh` receives `ADM-000002`.

## Part D — Teacher Flow & Exam Publishing

7. **Teacher marks attendance & enters marks**
   - Sign in as the invited teacher (`/teacher`). Mark attendance for `Class 1-A` today on `/teacher/attendance`.
   - As principal on `/exams`, create exam `Mid Term` (status `marks_open`).
   - As teacher on `/teacher/marks`, enter marks for `Rohan Verma` and `Ananya Singh` in `Mathematics` and click **Save all**.
   - **Expected result:** Attendance and marks save cleanly. Principal sees updated today attendance on `/principal` and marks in `/exams` (`Class result sheet`).

8. **Principal publishes results**
   - As principal on `/exams`, click **Publish results** for `Mid Term` and confirm.
   - As teacher on `/teacher/marks`, select `Mid Term`.
   - **Expected result:** Exam becomes read-only with lock message; teacher edits are blocked at both UI and database level. Student profile `/students/[id]` displays the published exam marks.

## Part E — Transfer Certificate, Promotion, Notices, Admissions, Reports & Profile

9. **Issue a Transfer Certificate**
   - Open `/students/[id]` for `Ananya Singh`, click **Issue transfer certificate**, enter reason `Family relocation` and confirm. Click **View / Print TC**.
   - **Expected result:** Student status becomes `left`, `TC-000001` is issued, `/students/[id]/transfer-certificate` renders print-ready layout, and **Print / Save as PDF** opens browser print dialog without sidebar/nav. Issuing a second TC for the same student is rejected.

10. **Promote a class**
    - Open `/students/promote`, select From `Class 1-A` and To `Class 2-A`, tick `Rohan Verma`, preview, and confirm.
    - **Expected result:** Reports `1 student(s) moved`. `Rohan Verma` now belongs to `Class 2-A`; `Ananya Singh` (`left`) is excluded from active promotion source list.

11. **Notices, Admissions, Reports & School Profile**
    - On `/notices`, post a pinned notice (`all` audience), edit its title, verify creator name and audience filter work.
    - On `/admissions`, create an enquiry with today's follow-up date and verify Overview "Needs attention" reflects it.
    - On `/reports`, inspect Attendance (test "Below 75% only"), Enrolment, Results, and Admissions tabs; export CSV on each.
    - On `/settings`, update school phone, city, and principal name; confirm `School Code`, `Status`, `Academic Year` are read-only.
    - **Expected result:** All mutations persist; CSV files download cleanly with accurate counts.

12. **Remove teacher access**
    - On `/staff`, click **Remove access** for the teacher who is class teacher of `Class 1-A`.
    - **Expected result:** Confirm dialog warns that the teacher is a class teacher; confirming unassigns `Class 1-A` (`class_teacher` becomes null) and removes the membership cleanly.

## Part F — Negative & Security Checks

13. **Cross-school isolation & role restrictions**
    - Sign in as a principal of **School B** and navigate manually to School A's student ID `/students/<school-a-student-id>` or query School A records.
      - **Expected result:** Student not found / zero rows returned; zero writes possible.
    - Sign in as **Teacher** or **Student** and try navigating to `/principal`, `/students`, `/reports`, or `/admissions`.
      - **Expected result:** Blocked with "This section isn't part of your role" and redirected home; RPCs return zero rows.

14. **Suspended school / franchise read-only behavior**
    - As Central Admin, suspend the school (or its parent franchise) via `/admin/schools` or `/admin/franchises`.
    - Reload as Principal.
    - **Expected result:** Amber/red banner displays `"This school is read only (suspended or inactive)"`. Principal can still view all tabs/students/reports and export CSV, while all write buttons are disabled in UI and rejected by Postgres RLS/RPCs (`42501`).
