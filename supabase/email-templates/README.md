# Plum Creek HOA authentication email templates

These templates were applied to the hosted Supabase project on October 11, 2026. GitHub website deployment does not apply Supabase Auth configuration. Before any future config push, pull current remote settings and review the diff; never push a fresh default configuration over production settings.

In **Authentication → Emails**, set these subject/content pairs:

| Email | Subject | HTML |
| --- | --- | --- |
| Confirm sign up | Plum Creek HOA — Confirm your email | `confirmation.html` |
| Reset password | Plum Creek HOA — Reset your password | `recovery.html` |

Both templates use Supabase's `{{ .ConfirmationURL }}` so the existing verification endpoint verifies the token and redirects to the portal. They do not embed a localhost address or manually bypass email verification.

On October 11, 2026, Site URL and the exact allowed callback were set to `https://plumcreekgardner.com/portal/` in the hosted project. The previous Site URL was `http://localhost:3000`, with no additional allowed callbacks. The CLI preview showed only these two changes; a post-update comparison confirmed no remaining differences and email confirmation remains enabled. The website already sends `window.location.origin + "/portal/"` for signup and recovery.

Save the settings and request a fresh confirmation or reset email from the hosted portal. Previously sent emails retain their original link. If confirmation already succeeded before the localhost redirect, sign in normally instead of signing up again.

This free project was created October 11, 2026. Under Supabase's June 3, 2026 policy, new free projects using its default mail service cannot edit authentication email templates. Custom Resend SMTP is now enabled, and both branded subject/content pairs above are applied. Hosted source and previews were checked, including the intact `{{ .ConfirmationURL }}` placeholders. Enter mail credentials directly in Supabase, never in chat, browser code or Git. Keep email confirmation enabled.

Resend setup continued October 11, 2026: account access was verified, `auth.plumcreekgardner.com` was created, and its four exact DNS records were added to Cloudflare. Resend reports the domain and all records verified. Sending is enabled, receiving is disabled, and click/open tracking are disabled. The website DNS records were preserved.

The user created the **Plum Creek Supabase Auth SMTP** key and entered it directly in Supabase. Its **Sending access** permission and restriction to `auth.plumcreekgardner.com` were verified afterward. Saved SMTP settings: host `smtp.resend.com`, port `465`, username `resend`, sender name **Plum Creek HOA**, sender address `no-reply@auth.plumcreekgardner.com`. The credential remains in the provider dashboards. The saved email interval is five minutes per user and the global limit is 30 auth emails per hour.

A single password-reset delivery test, explicitly authorized by the user, was accepted by Supabase and reported **delivered** by Resend on October 11, 2026. The sent message's sender, branded recovery body and production portal redirect were verified without following the reset link. The agent did not change a password. Inbox placement, completing password recovery, and a separate new-signup delivery test were not checked. Site URL/callback and email confirmation were rechecked after the template update. [Resend SMTP setup](https://resend.com/docs/send-with-supabase-smtp), [domain verification](https://resend.com/docs/dashboard/domains/introduction), [Supabase template restriction](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

References: [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
