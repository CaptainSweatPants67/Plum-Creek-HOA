# Rental agreements and member access

Implemented October 12, 2026. Owners use **My information & properties** (`/members/`) to report a rental, upload a tenant agreement PDF and enter its lease start and end dates. Rental paperwork and independent ownership approval are separate requirements.

When an active property request is declared a rental, or leadership marks its property as **Rental**, a completed current agreement is required. Missing, future, expired or rejected paperwork restricts that property's details and the account's member library (bylaws, leadership history, minutes and announcements). The account can still sign in, update contact details and complete its rental paperwork. The dates are inclusive and use the HOA's America/Chicago calendar day. An HOA-recorded rental status cannot be cleared by the homeowner; leadership corrects occupancy in `/admin/`.

New rental property requests include required date fields and a PDF upload. If an upload fails after the request is saved, the request is retained; finish the paperwork in **Rental homes & lease documents** rather than submitting a duplicate request. Incomplete uploads reserve space and must be removed before retrying. Owners can add a replacement before removing the old lease, subject to the storage budget. Removing the last current lease immediately restricts access.

**Rental agreements & lease dates** in `/admin/` lets current Directors, Officers and system administrators with MFA download agreements, record why a PDF needs replacement, and remove obsolete files. Agreements retained after ownership is revoked remain available to leadership for cleanup. An owner whose access is revoked loses document access immediately. Never treat rental uploads, signup codes or historical contact matches as proof of ownership. A reviewer cannot approve their own property request.

## Privacy and enforcement

The existing `property_documents` and `rental_agreements` tables are extended additively. Original `hoa-private-documents` records remain locked and are not exposed by the new policies. New PDFs use private `hoa-rental-agreements`, with authenticated downloads and no public or signed share links. Owners access their own active request's documents; verified co-owners can read and satisfy the requirement with a verified co-owner's current lease. A pending unverified claim cannot expose another owner's PDF or satisfy that owner's requirement. Leadership with MFA can review portal agreements.

Metadata is immutable to browser clients. A narrow function reserves an authorized file path, Storage permits a PDF at that path, and finalization checks actual Storage size and MIME type against the selected file. Until finalization succeeds, the lease does not satisfy access requirements. The browser also checks the PDF signature and size. These are format checks, not automated validation of the legal content; leadership can flag incorrect paperwork for replacement.

The member access rule is enforced by database functions, direct table policies and Storage policies, as well as the page gate. Private documents are never preloaded. Previously downloaded copies cannot be recalled. File removal deletes the Storage object first and only then its metadata, ensuring storage accounting tracks retained files. There is no automatic destruction of lease history; owners or leadership remove unneeded PDFs explicitly.

## Storage budget

- Each rental PDF: **2 MB** (2,000,000 bytes).
- Rental documents: **250 MB** including unfinished reservations; at most three PDFs per property request and one unfinished upload.
- Contracts/minutes/announcements retain their separate **500 MB** budget.
- All new uploads share the existing **800 MB project guard**, counting stored objects in every bucket and unfinished reservations in both features under one database lock.
- Existing bylaws use about **3.8 MB**. The planned feature budgets total about **753.8 MB**, leaving about 246 MB below the current 1 GB free storage allowance. Other organization projects, manually administered uploads, database growth and download bandwidth still need monitoring. See [Supabase pricing](https://supabase.com/pricing).

If all 119 homes were rentals, keeping three 250 KB agreements per home would use **89.25 MB**; at 500 KB it would use **178.5 MB**. Replacing unneeded old files keeps this bounded over repeated lease renewals. Keeping every 250 KB agreement forever would grow about **29.75 MB/year**, filling the 250 MB rental budget in about **8.4 years**. Large 2 MB scans for every home would consume 238 MB for a single round, so export compact text PDFs and aim below 500 KB. Limits are a safeguard, not a guarantee against changes to the provider's free plan or bandwidth overages.

## Verification

Isolated PostgreSQL tests cover own/other account isolation, admin rental flags, current/expired/future/rejected leases, incomplete uploads, actual bytes/MIME matching, co-owner sharing, unverified claims, revocation, deletion order, retention and both directions of shared storage reservations. A hosted PostgreSQL transaction also tested rental declarations, MFA review, private object policies and member restrictions; every fixture was rolled back. Its Storage objects contained metadata-only fixtures, not an uploaded tenant PDF.

Browser tests intercept all Supabase requests and check the upload/download forms, date and file validation, failed-upload cleanup, rental library gate, administrator rental status and mobile layout. [Passcode replacement](signup-passcode.md) accepts a typed, confirmed code and returns the saved code in the same transaction; validation, success, cancellation and failure were checked without native dialogs. A separate hosted passcode test was rolled back, preserving the real signup code and tickets. A real user's tenant PDF has not been uploaded during verification.


Homeowners now choose exactly one explicit answer per home: **I rent out or lease my home.** or **I currently live in this home.** New property requests require an answer; the property/rental section provides **Save home occupancy** for existing requests. These are member declarations, separate from leadership occupancy records. Selecting currently living in an HOA-marked rental does not remove its lease-paperwork requirement; leadership must correct that record.
