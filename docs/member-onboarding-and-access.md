# Membership applications and workspace access

New confirmed accounts see one **Complete your membership application** form under **My membership application**. It collects structured contact information, a separate HOA notification email, optional email-notice consent, the property, the required occupancy choice, joint household members and any trust details. Mailing street/city/state/ZIP are required. Rental homes—including homes marked as rentals by leadership—require a PDF up to 2 MB and lease dates covering today.

**Submit membership application** saves profile, consent, property request and household details in one database transaction. The rental PDF then uploads through the existing private Storage workflow. A failed upload leaves an unfinished application that can resume against the same request; incomplete uploads can be removed beside the form before retrying. It does not create duplicate pending requests. Existing storage budgets and file limits are retained.

After successful submission, the form is replaced by a persistent **Pending approval** page. Regular applicants see their application and Password links until approval. The portal checks status every 30 seconds and when focused; **Check approval status** refreshes immediately. Approval restores the current member menu and update forms. Rejected/revoked applicants without another approved home see the review response and can submit corrected information. Approved members retain their update and rental forms if a lease later expires, while member information remains restricted until the lease is current again.

Member library, leadership history and member-only calendar reads now require approved ownership (or authorized staff with MFA), in addition to existing rental requirements. Own profile, application status and appropriate upload endpoints stay available during setup/review. Public rosters and public events are unchanged. Historical contacts remain unverified and cannot grant ownership or account privileges.

## Reviewing applications

Open **HOA administration → Property verification reviews** after verifying MFA. This section is first on the page, includes a pending count, status filter and **Refresh requests**, and shows actual loading errors with a retry path. Saving contact information alone does not submit a property request; those accounts are visible in the account list below as **not submitted**.

System administrators may review their own property request. The evidence/reason field is still required, and the audit event records `administrator_self_review: true`. Other reviewers cannot self-approve or self-revoke. The migration does not approve any real request automatically. Rental approval still requires completed current paperwork.

## Granting and revoking workspace access

System administrators with MFA use **Member accounts & workspace access** to search every confirmed registered account. Check or uncheck the desired workspaces and select **Save workspace access**.

| Checkbox | Grants |
| --- | --- |
| Officer & Director tools | Service contacts, contracts, minutes, announcements and calendar management |
| HOA administration | Membership/property/rental reviews, historical contact maintenance, Treasury, homeowner notices, submitted household records, signup-code viewing and calendar management |

These are private workspace permissions, separate from public Board/Officer appointments and ownership approval. Current appointments provide default access unless explicitly overridden. Explicit checkbox settings persist until changed; expiring a public appointment does not revoke a separate explicit grant. Unchecking a workspace revokes it even if an appointment remains published. System administrators retain both workspaces and cannot be locked out by these controls. MFA is required to exercise either workspace; permissions are rechecked from the database on every protected operation. Menus refresh on focus and authentication changes. Permission changes are audited.

The checkboxes do **not** create additional system administrators. Assigning permissions, editing formal appointments, replacing the shared signup code, and unlocking the service password safe remain system-administrator operations. The safe keeps its existing live-session/fresh-authenticator restrictions.

## Verification

The migration is additive: a private RLS-protected access table plus narrowly granted invoker RPCs/private authorized functions. Tests cover atomic submission, duplicate prevention, pending/approval transitions, rejected applications, unapproved member-data restrictions, administrator self-review/evidence/MFA/audit, grant/revoke under existing tokens, appointment overrides without roster edits, tools-only calendar access, rental completion/expiration and failed-upload retries. Hosted SQL tests use temporary synthetic accounts and roll back every fixture, grant and approval. Browser tests intercept all Supabase requests and exercise desktop/mobile setup, a persistent pending page, approved update forms, registered accounts without requests, request refresh errors, self-review and workspace controls. No emails or real signup/review actions are performed by these tests.
