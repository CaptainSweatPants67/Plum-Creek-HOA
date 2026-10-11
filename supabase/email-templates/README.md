# Plum Creek HOA authentication email templates

These templates are prepared for the hosted Supabase project. GitHub website deployment does not apply Supabase Auth configuration. Do not run a whole-project config push from a new default configuration: it could replace existing settings.

In **Authentication → Emails**, set these subject/content pairs:

| Email | Subject | HTML |
| --- | --- | --- |
| Confirm sign up | Plum Creek HOA — Confirm your email | `confirmation.html` |
| Reset password | Plum Creek HOA — Reset your password | `recovery.html` |

Both templates use Supabase's `{{ .ConfirmationURL }}` so the existing verification endpoint verifies the token and redirects to the portal. They do not embed a localhost address or manually bypass email verification.

On October 11, 2026, Site URL and the exact allowed callback were set to `https://plumcreekgardner.com/portal/` in the hosted project. The previous Site URL was `http://localhost:3000`, with no additional allowed callbacks. The CLI preview showed only these two changes; a post-update comparison confirmed no remaining differences and email confirmation remains enabled. The website already sends `window.location.origin + "/portal/"` for signup and recovery.

Save the settings and request a fresh confirmation or reset email from the hosted portal. Previously sent emails retain their original link. If confirmation already succeeded before the localhost redirect, sign in normally instead of signing up again.

This free project was created October 11, 2026. Under Supabase's June 3, 2026 policy, new free projects using its default mail service cannot edit authentication email templates. These prepared templates are not applied yet: configuring custom SMTP will enable branded content, a Plum Creek sender and delivery to homeowners outside the project's team. Enter mail credentials in Supabase, never in browser code or Git. Keep email confirmation enabled.

Recommended next setup: create a free Resend account, verify the owned `plumcreekgardner.com` domain (or an `auth` subdomain) with the exact DNS records Resend provides, and configure Supabase SMTP. Use sender name **Plum Creek HOA** and an address on the verified sending domain, such as `no-reply@auth.plumcreekgardner.com` if that subdomain is verified. Keep link tracking disabled for Auth emails. No Resend account, DNS records or SMTP credentials were created by this change. [Resend SMTP setup](https://resend.com/docs/send-with-supabase-smtp), [domain verification](https://resend.com/docs/dashboard/domains/introduction), [Supabase template restriction](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

References: [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
