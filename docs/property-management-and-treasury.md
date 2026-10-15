# Property management, Treasury and homeowner notices

Open **HOA administration**, then choose **Property management** or **Treasury**. Both pages require HOA administration access and MFA. System administrators grant or revoke that access under **Member accounts & workspace access**. Financial details, contact records, notice recipients and delivery history are never available to public or ordinary member accounts.

## Property management

Search by lot, address, homeowner or email. Filter rentals or delinquent properties. Each lot shows its total owed across all posted ledger years. An overdue unpaid charge makes the home red and adds a textual delinquency amount; charges that are not due yet are included in total owed but are not delinquent.

**Manage lot** shows verified current homeowners, their login-email confirmation, member-provided notification email, notice consent for that address, delivery block, latest site-email outcome and rental paperwork status. Login confirmation does not independently verify a different notification address. Rental flags and member declarations retain the existing current-lease requirement.

**HOA record homeowners** edits structured names, emails, phone, mailing address and notes for historical/unverified records, or adds a new reference contact. Saving does not grant ownership, create an Auth account, record email-notice consent, or promote an email to verified. The original legacy import snapshot remains intact. Verified/account-linked contacts cannot be edited through the historical form. Concurrent edits require a refresh.

**Reset or revoke approval** requires a reason and explicit confirmation. Revoke/moved away ends that property link immediately. Reset revokes the old link and creates a pending request requiring ownership review again. Existing rental files/history remain; a reset requires current paperwork against the new request before rental approval. Other approved properties and separately granted staff tools are unaffected. Staff grants must be changed separately if a former homeowner should also stop serving as staff. Only system administrators may reset/revoke their own approval, matching the existing self-review rule.

## Treasury

No financial balances, assessments or year defaults are inferred from historical contact files. Until data is entered, the ledger is empty and lots show **Not assessed**. Historical data will be imported separately when supplied.

1. Choose an assessment year. Save annual dues, due date, late fee, lien fee, annual simple-interest rate and a policy/source note.
2. Review and confirm **Assess annual dues to all lots**, or assess a single lot. Existing active annual assessments are skipped. Changing settings affects future assessments, never posted entries.
3. Select a lot or its **Dues paid** checkbox to open payment entry. Choose a payment method, date, exact amount and note, then confirm and save. A checkbox click alone does not fabricate a payment. Partial payments are supported. The dues checkbox becomes paid when that year's dues-category balance reaches zero; fees can remain outstanding.
4. Record fees manually. Late/lien/interest assessment requires overdue unpaid dues for the selected year. Each charge category may be assessed once per lot/year; an incorrect charge can be voided and replaced. Interest is one annual simple charge on that year's unpaid dues at assessment time, without compounding or daily/monthly accrual. A lien fee entry records a ledger charge and does not file a lien.
5. Correct an entry with **Void**, a reason and confirmation. The original receipt/charge remains visible. Void payments before voiding their underlying charge. Repeated submissions use stable action keys and cannot silently duplicate receipts.

Payments are allocated to the selected **assessment year and category**. To pay an earlier balance, select that earlier year. Each amount is recorded once. Prior-year totals are calculated from earlier ledgers; they are not duplicate carry-forward charges. Use a historical opening balance only for a documented amount not also represented by imported prior-year entries.

Year summaries show assessed dues/fees/interest/opening balances, payments allocated to that assessment year, the year's unpaid balance, prior-year unpaid balance and all-year total owed. They are not a cash-receipts report grouped by payment-calendar year. **Download year summary** exports the same rows as CSV, with spreadsheet-formula protection. Payments store their actual date, method and reference in ledger history.

## Homeowner email

**Download email list** exports current verified homeowners who consented to notices at their current notification address. Historical, revoked/moved-away, blocked and non-consenting records are excluded. Shared email addresses are deduplicated. The scope can be all eligible homeowners or the selected lot.

Compose a plain-text HOA operational notice, review the exact recipients, and **Prepare notice for review**. Preparation does not send. Expand the prepared notice, choose **Send next batch**, then confirm. Each address receives its own message; other homeowners' addresses are not disclosed. The server uses only saved message content and database-selected recipients. It rechecks administration access, ownership, consent and suppression before sending each recipient. Notices are sent from `Plum Creek HOA <notices@auth.plumcreekgardner.com>` with replies directed to `pchoa66030@gmail.com` and a footer linking to member notification preferences.

Batches contain at most ten addresses. At most 80 new notice recipients may be attempted per rolling 24 hours. The connected Resend plan was verified on October 15, 2026 as 100 emails/day and 3,000/month, shared with Auth. This conservative notice cap leaves capacity for authentication messages but cannot guarantee capacity if other sending consumes the account quota. Remaining recipients stay queued; provider limits stop the batch. No timer or background job automatically sends messages.

Delivery statuses distinguish queued, sending, provider accepted, delivered, delayed, failed, bounced, complained, suppressed, skipped and uncertain. Accepted does not mean delivered or read. Signed, replay-age-checked webhooks update delivery outcomes, including events arriving before the send receipt is saved. Bounce/complaint/suppression blocks prevent future sends. An administrator can add/remove a manual block with a reason; a bounce/complaint requires a working replacement notification address. Consent itself remains homeowner-controlled. Open/click tracking is disabled on the verified sending domain.

Retries reuse a per-recipient Resend idempotency key. An ambiguous delivery older than 23 hours is marked uncertain and is not resent after the provider's 24-hour duplicate-protection window. Check Resend before preparing a replacement notice. Failed/uncertain recipients are visible rather than silently retried indefinitely.

### Sender configuration

The static website never receives email credentials. Supabase Edge Functions use server secrets:

- `HOA_RESEND_API_KEY`: a separate Sending access key restricted to `auth.plumcreekgardner.com`; enter it directly under Edge Functions → Secrets.
- `HOA_RESEND_WEBHOOK_SECRET`: the signing secret for the connected Resend delivery webhook.

`hoa-notices` requires a user JWT, independently verifies the user through Auth, and enforces administration/MFA using database flags. `hoa-notice-events` accepts no user JWT and instead verifies the exact raw body with the webhook HMAC, event ID and timestamp before invoking a service-only status RPC. Both are deployed from `supabase/functions/`; public invoker RPCs expose no sender secret or arbitrary delivery destination. Sending remains disabled until both secrets exist. Auth SMTP credentials and templates are unchanged.

## Verification

The additive migration locks private tables, grants only narrow invoker RPCs, validates amounts and concurrent edits, serializes per-lot ledger mutations, and audits changes. PostgreSQL tests cover unauthorized reads/writes, exact balances and carry-forward arithmetic, partial payments, duplicate prevention, fees/interest, corrections, reference edits without verification, consent eligibility, delivery event ordering/suppression, and reset/revocation. Sender tests mock every external call and validate authentication, recipient/content isolation, stable retry keys and webhook signatures. Desktop/mobile browser checks intercept every Supabase request. Hosted migration and installed-workflow tests use temporary synthetic accounts/properties and roll back all test data. No actual fee, homeowner approval or outbound email is created during verification.
