# Franchisee Dashboard Manual QA Script (~20 Minutes)

Run every step in order against a live Supabase project where all migrations through `20261124000003_franchisee_finalization.sql` have been applied.

## Part A — Multi-Franchise & Overview

1. **Create franchises & assign owner (as Central Admin)**
   - Sign in as `central_super_admin`, go to `/admin/franchises`, create two active franchises (e.g., `North Zone` and `South Zone`) under an active Master Franchise, and invite the same user as `Franchise Owner` for both.
   - **Expected result:** Owner signs in and lands automatically on `/franchise/dashboard`. A franchise switcher dropdown appears in the top header showing both `North Zone` and `South Zone`. Switching franchises updates the Overview, Schools, Team, Reports, and Settings pages to only show data for the selected franchise.

2. **Empty franchise onboarding card**
   - Select a franchise with 0 schools.
   - **Expected result:** Overview shows a "Welcome to your franchise" getting-started card with a **Request a school** button linking to `/franchise/schools`.

## Part B — School Request Lifecycle

3. **Request a new school**
   - Open `/franchise/schools`, click **Request school**, enter `Centennial North Campus`, city, state, address, and submit.
   - **Expected result:** School is created with status `Pending` (`onboarding`) and appears in the list. It also appears in **Central Admin → Onboarding & Approvals**.

4. **Edit and cancel a pending school request**
   - Click **Edit** on the pending school, change the city, and save (`update_school_request`).
   - Create a second pending school request and click **Cancel** (`cancel_school_request`), then confirm.
   - **Expected result:** First school updates cleanly; second school is permanently deleted and an audit row is written.

5. **Declined school & resubmit**
   - As Central Admin in **Onboarding & Approvals**, decline `Centennial North Campus` with reason `"Missing lease agreement"`.
   - Reload `/franchise/schools` as the franchisee.
   - **Expected result:** Status badge shows `Declined` with `"Missing lease agreement"` visible. Overview **Needs attention** lists the declined school. Click **Edit & resubmit**, update the address, and submit (`resubmit_school_request`). Status returns to `Pending` and `decline_reason` clears.

6. **Approve school & open as principal**
   - As Central Admin, approve `Centennial North Campus` (`active`).
   - On `/franchise/dashboard` or `/franchise/schools`, click **Open school** on `Centennial North Campus`.
   - **Expected result:** Switches to the school workspace (`/principal`) with the full school sidebar and a **Back to franchise** link at the top of the sidebar.

## Part C — Team, Reports & Settings

7. **Invite & remove school staff**
   - Open `/franchise/team` (or `/franchise/schools/[id]`), click **Invite staff**, and invite a `School Principal` (`principal@example.com`) and a `Teacher` (`teacher@example.com`) for `Centennial North Campus`.
   - **Expected result:** Pending invites appear with `Invited` badge. Removing an invite or active member prompts a confirmation dialog and revokes access immediately. Attempting to escalate to `franchise_owner` or `central_super_admin` is blocked by RLS/API (403).

8. **Cross-school reports & CSV export**
   - Open `/franchise/reports`. Check **Attendance**, **Enrolment**, **Admissions**, and **Comparison** tabs, adjust date filters, and click **Export CSV** on each tab.
   - **Expected result:** Tables load live aggregate data for the active franchise only, and each CSV downloads cleanly.

9. **Franchise settings**
   - Open `/franchise/settings`. Verify `Franchise Code`, `Status`, `Territory`, and `Master Franchise` are read-only (`Lock` icon). Update `Owner name`, `Phone`, `Email`, `Address`, `City`, `State`, and save (`update_franchise_contact`).
   - **Expected result:** Contact details persist across reload; brand support contact from `network_settings` displays below.

## Part D — Suspended Read-Only & Preview Mode

10. **Suspended franchise / master**
    - As Central Admin, suspend the franchise (or its master franchise). Reload `/franchise/dashboard`, `/franchise/schools`, `/franchise/team`, and `/franchise/settings`.
    - **Expected result:** Amber read-only banner is shown; **Request school**, **Edit**, **Cancel**, **Invite staff**, **Remove**, and **Save changes** are hidden/disabled, and direct RPC/table writes fail with RLS/permission errors.

11. **Preview mode (Central Admin & Master Owner)**
    - As Central Admin or Master Owner, open `/franchise/dashboard?franchiseId=<uuid>`.
    - **Expected result:** Blue preview banner is shown (`read-only`). All franchise pages display the franchise's data without allowing mutations. Non-leadership roles (`student`, `teacher`, `parent`) navigating to `/franchise/*` are blocked and redirected home.
