# Plum Creek HOA authentication email templates

These templates are prepared for the hosted Supabase project. GitHub website deployment does not apply Supabase Auth configuration. Do not run a whole-project config push from a new default configuration: it could replace existing settings.

In **Authentication → Emails**, set these subject/content pairs:

| Email | Subject | HTML |
| --- | --- | --- |
| Confirm sign up | Plum Creek HOA — Confirm your email | `confirmation.html` |
| Reset password | Plum Creek HOA — Reset your password | `recovery.html` |

Both templates use Supabase's `{{ .ConfirmationURL }}` so the existing verification endpoint verifies the token and redirects to the portal. They do not embed a localhost address or manually bypass email verification.

In **Authentication → URL Configuration**, set Site URL to the verified hosted website's `/portal/` URL and add that exact URL to Redirect URLs. Preserve other existing entries; add only verified website origins. The website already sends `window.location.origin + "/portal/"` for signup and recovery.

Save the settings and request a fresh confirmation or reset email from the hosted portal. Previously sent emails retain their original link. If confirmation already succeeded before the localhost redirect, sign in normally instead of signing up again.

Email subjects and HTML can be branded while the default mail service remains in use. A Plum Creek sender address/display name and general homeowner delivery require configured custom SMTP with a sender authorized by the email provider. Enter mail credentials in Supabase, never in browser code or Git. Keep email confirmation enabled.

References: [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
