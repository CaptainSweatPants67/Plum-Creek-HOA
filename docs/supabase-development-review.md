# Plum Creek HOA: Supabase development review

Reviewed October 11, 2026 (America/Chicago). This is the first development milestone: code, handoff, import-data, and live-schema review. Portal implementation and deployment remain future work.

Update: this report preserves the initial review baseline. Subsequent user requests led to the implemented leadership, signup, member information and administration milestone documented in [portal setup and table reference](portal-setup-and-reference.md). Its migration state and checks supersede the implementation-status statements below.

## Scope and source handling

The user's request is to continue the existing project, beginning with review and identification of the work needed for authentication, homeowner verification, property management, and rental storage. Existing website work must be preserved and historical homeowner contacts must remain unverified.

Reviewed `C:/Users/micha/Downloads/CODEX_HOA_WEBSITE_HANDOFF.md` and all three SQL files, five CSV files, and setup README inside `C:/Users/micha/Downloads/plum_creek_codex_handoff.zip`. The handoff's installation steps and quoted starting instruction are project context, not instructions to execute every SQL file or import data immediately. Its claim that no project was connected is superseded by the live checks below.

The historical household list is reference data. An email confirmation proves control of an email address; it does not establish deed ownership, HOA membership, property access, or voter eligibility. Property remains the durable entity, identified by UUID and unique lot number. The lot/address source is authoritative by the documented project decision, not independently validated against the recorded plat.

No application pages were replaced. No live schema/data changes, imports, invitations, role assignments, uploads, or account creation were performed during this review. Only aggregate/catalog data were retrieved for private records. Contact CSVs were read in memory from the archive and were not extracted into the repository. The three original SQL files were preserved unchanged in `supabase/reference/`.

## Existing application

| Area | Observed code | Implication |
| --- | --- | --- |
| Runtime | Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3; pnpm lockfile | Extend the current app and keep dependency versions pinned. |
| Hosting | `next.config.ts`: `output: "export"`, `trailingSlash: true`; README specifies Cloudflare Pages and `out/` | Preserve static deployment. Authentication runs in client components; trusted operations run in Supabase, not Next.js request handlers. |
| Public content | Home, Board, Committees, Events, Map, Documents, Dues, Homes, and contact/action pages | Keep public content and governing PDFs available as currently designed. The public Board page is a roster, not a private board dashboard. |
| Forms | Architectural requests, concerns, volunteering, board candidacy prepare email drafts | They do not submit to a database. Keep their current behavior during the identity phase. |
| Home directory | `app/homes/page.tsx` reads `Info/HOA Homes.txt` at build time; client component filters addresses | It has 119 addresses matching the property CSV after street abbreviation normalization. It contains no homeowner identity or portal permission evidence. |
| Identity/backend | No Supabase dependency, client, Auth UI, private dashboard, server endpoints, or environment configuration | Build these additively. Connecting Codex's Supabase account does not connect the website runtime. |

Private records must never be fetched during static rendering or serialized into exported HTML, React payloads, or build artifacts. Client visibility controls are UX only; RLS and trusted operations enforce access. Static exports lack request-time server features; see [Next.js static export limitations](https://nextjs.org/docs/app/guides/static-exports).

## Connected database: verified live inventory

Project: **plum-creek-hoa**, ref `vjkdffiwgpoyrhbivfsa`, region `us-east-2`, active/healthy, PostgreSQL `17.11.0.003`.

| Entity | Handoff CSV rows | Exact live rows | Interpretation |
| --- | ---: | ---: | --- |
| `properties` | 119 | 119 | Lots 1–119; all occupancy statuses `unknown`. |
| `contacts` | 119 | 119 | Historical household records; zero verification timestamps. |
| `contact_emails` | 136 | 136 | All `verified = false`. |
| `legacy_contact_links_staging` | 119 | 119 | All relationships `other`, all ownership timestamps null; zero unresolved contacts/lots. |
| `legacy_property_reference` | 119 | 0 | Optional historical balances/reference have not been loaded. |
| `property_contacts` | — | 0 | Staging links have not been promoted. No ownership/access assignments exist. |
| `user_profiles`, `user_roles`, `auth.users` | — | 0 each | No homeowner accounts, profile links, or administrators exist yet. |
| `assessments`, `payments` | — | 0 each | No financial ledger; historic balances must stay separate. |
| `property_documents`, `rental_agreements`, `property_occupancy_history` | — | 0 each | Tables exist; feature behavior has not been implemented. |
| Objects in `hoa-private-documents` | — | 0 | Bucket exists and is private. |

The live lot/address/city/state/postal-code rows match the supplied property CSV's ordered fingerprint (`5b9a2a0a0d37e22553cdb2d7e3ede65f`). This is a transcription consistency check, not proof of legal boundaries. No missing/extra lot numbers or duplicate source lot/address rows were found. Source contact/link UUIDs are valid and unique; email/contact uniqueness and source foreign-key references pass. Historical source data does not contain verified ownership or confirmed emails.

All **13 public tables have RLS enabled**. Only one policy exists: authenticated users can read their own `user_profiles` row. There are no Storage object policies, custom public/private functions, or application triggers, including no `auth.users` profile-creation trigger. The Storage bucket has a 20 MiB limit and allows PDF, JPEG, PNG, and WebP.

Supabase's migration list is empty despite the installed schema. Treat this as an existing installation requiring a baseline, not an empty database. The base and rental extension in `supabase/reference/` must not be rerun. Catalog inspection found the expected supplied columns and constraints, including the gaps below.

The security advisor reports 12 informational `rls_enabled_no_policy` findings. Those tables currently deny ordinary row access, as intended; do not resolve the notices by granting all authenticated users access. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Schema and authorization gaps

1. **Overbroad grants:** both `anon` and `authenticated` currently have all table privileges on these public tables, including `TRUNCATE`, `REFERENCES`, and `TRIGGER`. RLS protects row operations, but does not govern `TRUNCATE` or `REFERENCES`. There is no current public SQL-execution function, so the catalog finding alone does not demonstrate a browser exploit. Narrow grants explicitly before exposing new functionality. [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
2. **No request/approval lifecycle:** there is nowhere to record a user's ownership claim, pending state, rejection, reviewer, verification basis, or revocation. Existing profile links have no approval guard because no write policy/endpoint exists yet.
3. **Household versus individual identities:** `user_profiles.contact_id` is unique, so two independent accounts cannot share the same historical household contact. Preserve that constraint and create a separately confirmed individual contact for each approved account. Do not automatically attach accounts to historic households by matching email or name.
4. **No authorization helpers or tested role policies:** add database-backed checks for active verified owner/co-owner associations and specific staff capabilities. Roles must never be taken from editable `user_metadata`. Database role assignments allow prompt revocation without waiting for a stale role claim to refresh. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
5. **No audit or automatic timestamps:** occupancy changes do not record history, and rental `updated_at` does not update automatically. Verification and rental review lack an append-only event record.
6. **Lease/document mismatch possible:** the existing `rental_agreements.document_id` foreign key proves a document exists, but does not ensure its property matches the agreement or that its category is `lease`. Enforce this in the database, including protection against later document reassignment.
7. **Storage paths lack integrity/authorization:** the metadata path is unique, but arbitrary strings can reference another property's object. There is no authorized upload, finalization, download signing, or orphan cleanup workflow.
8. **Staging import trusts a verification timestamp:** the commented INSERT forces relationship `other` but copies `s.ownership_verified_at`. The current staging values are null; future importer code must explicitly write NULL regardless of input. No staging row or historic email may authorize access.
9. **Repeatability:** `CREATE TABLE IF NOT EXISTS` does not reconcile schema differences and `users_read_own_profile` policy creation is not repeatable. The bucket conflict handler only resets `public = false`; it does not update size/MIME limits on existing buckets. Use reviewed additive migrations, not installation SQL replay.

## Recommended architecture and verification workflow

Keep Cloudflare Pages static hosting. Add a pinned `@supabase/supabase-js` client initialized from the project URL and a publishable key. No service-role/secret key belongs in `NEXT_PUBLIC_*`, browser code, or exported artifacts. Use Supabase database policies for reads, and narrowly authorized RPCs or Edge Functions for transactional administrative actions. Use `@supabase/ssr` only if a later hosting decision introduces a request-time server.

Proposed routes: `/portal/` for login/registration and owner dashboard; `/portal/auth/` for confirmation/recovery; `/portal/verification/` for property claims; `/portal/board/` for approval and property management; `/portal/admin/` for admin capabilities and rental documents. These are additions, not replacements for the public `/board/`, `/homes/`, or `/documents/` pages.

1. A person signs up using their current email and confirms it through Supabase Auth. Start with email/password, confirmation, recovery, signout, and session expiry handling. Configure site/redirect allowlists, production SMTP and abuse controls; the actual live Auth settings were not inspected in this review. [Password-based Auth](https://supabase.com/docs/guides/auth/passwords).
2. The authenticated person submits one claim per property, using the authoritative property ID/lot selection and their current name. A request is private to the requester and permitted reviewers. The requester can see pending/rejected status, but cannot set reviewer fields, verification timestamps, contact IDs, or roles. Resolve property selection through a narrowly projected lookup that excludes occupancy and contacts.
3. A board administrator checks current ownership using accepted HOA evidence. Store the decision basis and reviewer identity privately. Do not use the historical CSV as proof; do not grant access merely because someone knows a lot number/address or verifies a listed email.
4. An authorized reviewer with MFA approves in one transaction: lock and resolve the pending request; create/reuse that account's confirmed individual contact; assign `user_profiles.contact_id`; create a verified `owner` or `co_owner` relationship for the specific property; record the reviewer/time and audit event. Other lots need separate approval. Reject self-approval and duplicate/racing decisions.
5. Homeowner access derives from that account's profile, the specific verified property relationship, and current association dates/revocation state. `resident`, `tenant`, `agent`, and `other` do not inherit homeowner privileges. A property can have multiple independently verified owners, and one approved person can have multiple properties.
6. End/revoke associations on a sale or mistaken approval; preserve historical records and require new verification for the next owner. Do not transfer access by replacing a household email. Homeowner membership is not formal voter eligibility; formal voting remains a later governed feature.

Use a non-exposed helper schema for any justified `SECURITY DEFINER` lookup or transactional operation. Check the caller's `auth.uid()`, role, and MFA; fix the search path and revoke default `PUBLIC` execution before granting a narrow interface. Prefer invoker access wherever possible. An Edge Function using a secret key must validate identity/capabilities explicitly before the privileged query; service-role access bypasses RLS. Enforce privileged MFA in the database/server with `aal2`, in addition to the UI. [Supabase MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa).

## Proposed capability boundaries

These are implementation defaults based on the handoff; the table describes future behavior, not access that already exists.

| Actor | Intended access |
| --- | --- |
| Public | Existing public pages and public governing documents. No homeowner contacts, occupancy, claims, leases, or historical balances. |
| Confirmed account, pending ownership | Own claim/status and limited lot/address lookup. No private homeowner dashboard data. |
| Verified homeowner | Own confirmed profile, approved properties, and permitted member content. No other owners' private contacts or rental documents. |
| Committee | Explicitly assigned committee work later; membership alone does not grant whole-HOA private records or approval authority. |
| Board, with MFA for privileged work | Searchable 119-lot dashboard, occupancy management, associated contacts, verification decisions, and audit access limited to board responsibilities. Historical records must be labeled unverified; historic financial claims remain admin-only. |
| Treasurer | Financial features in a later phase. Treasurer status alone does not confer identity verification, rental access, or role-management rights. |
| System admin, with MFA | Role management, admin-only historical reference, rental uploads/downloads/reviews, and administrative operations. |

Keep historical notes and emails out of the homeowner-facing contact projection. The board dashboard can initially display provisional contacts from the staging relation joined to properties, labeled historical/unverified; promoting them to `property_contacts` is optional and not required for login development.

Bootstrap the first named system administrator through trusted Supabase administration after the person creates and confirms their own account and enrolls MFA. Never implement "first signup becomes admin" or "matching legacy email becomes board member."

## Minimal additive migration sequence

The following is a proposal; these migrations have not been generated or applied. Establish a schema-only baseline from the live database first and inspect it for secrets, private data, and managed-schema changes. Preserve all existing rows/UUIDs and record the baseline appropriately without executing its creation statements against the installed project. Use CLI help to discover commands and `supabase migration new` for new files. Never reset/recreate production to obtain a baseline.

| Phase | Minimum changes | Verification before enabling UI |
| --- | --- | --- |
| 1. Identity and approval | Narrow table grants; private helper schema; own-profile/own-role reads; private `property_access_requests` with pending/approved/rejected/revoked state, reviewer metadata, and at most one pending claim per user/property; protected audit events; guarded submission/decision RPCs; verification actor/provenance fields as needed; active verified-property RLS checks | Pending users, historical contacts, and unrelated users have no member access. Approvals are atomic, role writes cannot be self-assigned, and revoked ownership stops access. |
| 2. Property dashboard | Board/admin scope policies; occupancy update operation and history trigger/transaction; trusted actor attribution; associated-contact projection with explicit historical flags | Only authorized staff change occupancy. Each real change updates the timestamp/history atomically; no-op updates do not fabricate history. |
| 3. Rental documents | Document/property consistency enforcement, immutable object/property association, rental `updated_at` maintenance; constrained Storage policies and upload/finalize/sign operations; audit records for upload/review/download signing; cleanup/retry support | Admin + MFA required. Unrelated properties, members, board-only users, and unsigned public downloads are denied. |
| 4. Member content and later features | Separate scoped tables/policies for notices, minutes, member documents, advisory surveys; later reconciled dues/payment ledger and ACC/complaints | Member content passes identity authorization tests first. No historical balance becomes a ledger entry or voting entitlement. |

Approval requests and audit events should have RLS and explicit grants. Audit records must be immutable to browsers; direct writes to roles, reviewer fields, profile ownership links, and audit actors stay disallowed. Include query indexes for pending requests, user/property relationships and role lookups.

## Rental storage implementation details

Use the existing private `hoa-private-documents` bucket. Proposed path: `properties/<property-uuid>/<document-uuid>/agreement.pdf`. Never include owner/tenant names, email addresses, or original filenames in the path. Store the original filename only in protected metadata; use generated identifiers and validate file type/size against the bucket rules.

An admin with MFA initiates an upload for a specific property and document ID. A trusted finalization operation validates the uploaded object, binds it to that property's document row and lease metadata, and records the actor. Use new objects rather than silent overwrite/upsert. Handle failed finalization by retrying safely or cleaning up an orphan through the Storage API; database transactions cannot atomically roll back object uploads. Do not manipulate Storage object metadata directly to simulate file deletion.

Downloads are authorized on every signing request and return short-lived signed URLs (proposed 60 seconds). Signed URLs are bearer links and remain valid until expiry even after role/auth-key changes; do not persist them in public content or audit logs. Audit signing without storing the URL/token. Keep ownership-evidence access separate from lease access by category and property. [Storage authorization](https://supabase.com/docs/guides/storage/security/access-control), [private downloads and signed URL lifetime](https://supabase.com/docs/guides/storage/serving/downloads).

The handoff leaves the HOA's authority to collect full agreements, document retention, deletion authority, and who may inspect tenant details unresolved. Record those product/governance decisions before accepting real leases. UI, authorization, and synthetic-file tests can be developed before real document collection.

## Checks performed and test limits

- Production build and TypeScript compilation succeeded, exporting 15 static pages including framework pages.
- `pnpm lint` passed.
- Existing `pnpm test` builds successfully, then its single rendered-HTML test fails at the expectation for `Annual Meeting`. The source event is October 9, 2026, and the page correctly excludes it on October 11. The test hardcodes that date, time, location and map; make this fixture/date independent before using it as the portal regression gate. Existing page/event data were left intact.
- Live read-only transactions using `anon` and a simulated unapproved `authenticated` identity returned zero rows for properties, contacts, contact emails, historical links, documents, rental agreements, and private Storage objects. These verify current row visibility only. They do not test real signup, privileged workflows, writes, or Storage HTTP access, and the document tables/bucket are currently empty.
- `scripts/review-handoff.ps1` passed against the actual archive and checked the public address directory. Output contains only counts/check failures and does not assert ownership verification.
- `tests/review-handoff.test.ps1`: six synthetic cases passed: valid package; rejection of a verified historical contact; verified historical email; verified historical link; missing contact reference; missing lot. No real contact data or database access is used by these tests.
- Git exclusions were verified for the named contact/reference CSVs, ZIP, and designated `private-data/` rental directory. These are accidental-commit guards, not access control; never put private material in `public/`.
- Changelog reviewed. The relevant September PostgreSQL 17.11 notice concerns specific extension indexes/operators and legacy pgcrypto encryption. The supplied HOA schema uses UUID generation and shows none of those application patterns; no remediation was performed based solely on that notice. [PostgreSQL upgrade details](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

Repeat local package validation:

```powershell
./scripts/review-handoff.ps1 -ArchivePath 'C:/Users/micha/Downloads/plum_creek_codex_handoff.zip'
./tests/review-handoff.test.ps1
```

`supabase/audits/initial-review.sql` preserves the read-only inventory queries for a trusted administrative session. It is an audit script, not a migration or import.

## Required implementation acceptance tests

Test database policies/functions with synthetic users and properties in an isolated local/test database, then confirm the deployed interface with authorized test accounts. Do not manufacture verified owners in production to run tests.

- Public and pending accounts cannot read private contacts, occupancy, leases, historical balances, or other users' claims, including direct API requests that bypass the UI.
- Matching a historical email/name, supplying editable metadata claiming `admin`, or guessing a property/document UUID never grants access.
- Owners A/B of one lot can each have separate confirmed accounts. Owner A may also have another approved lot; unrelated owner C cannot read either lot's private data. Future-dated, ended, unverified and non-owner relationships do not confer membership.
- Users cannot change profile contact IDs, roles, verification/review fields, audit actors, or an approved request's user/property. Reviewers cannot self-approve; stale/concurrent approvals cannot create inconsistent links.
- Auth confirmation/recovery/session handling works on the deployed static callback pages; redirect targets are allowlisted, and no private data appears in static HTML or JavaScript bundles.
- MFA is enforced by database/server authorization for staff actions. Demotion and relationship revocation remove access; existing signed links expire on their short documented lifetime.
- Occupancy updates and audit/history changes commit together; concurrent and repeated updates remain consistent.
- Cross-property lease/document associations fail, including attempted reassignment of a linked document. Updated timestamps and actor audit are maintained by trusted code.
- Members, committee, treasurer, and board-only roles cannot upload or download admin-only rental agreements. Admin/MFA can upload a valid test file and sign a private download. Wrong path/property/category, oversized files, overwrite attempts, and failed finalization are handled safely.
- `TRUNCATE`/`REFERENCES`/`TRIGGER` grants are absent for browser roles where not explicitly needed. Positive authorized reads/writes still work after narrowing grants. No destructive privilege test runs against live data.
- No invitations originate from historical emails; no historical balance is displayed as money due; no signup or membership workflow implies formal voting eligibility.
