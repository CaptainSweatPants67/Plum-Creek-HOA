"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rentalError } from "../../lib/rental-agreements";
import { WorkspaceSection } from "./WorkspaceSection";

export function EmailChange({ client, email, pendingEmail, onChanged }: { client: SupabaseClient; email: string; pendingEmail?: string | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const next = String(data.get("new_email") ?? "").trim();
    if (next.toLowerCase() === email.toLowerCase()) { setMessage("Enter a different email address."); return; }
    if (next !== String(data.get("confirm_email") ?? "").trim()) { setMessage("The two email addresses must match."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await client.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/portal/` });
      if (result.error) throw result.error;
      form.reset(); setMessage("Check both your current and new inboxes for confirmation links. Your login email changes after the required confirmations are complete."); onChanged();
    } catch (error) { setMessage(rentalError(error)); }
    finally { setBusy(false); }
  }
  return <WorkspaceSection title="Login email" description="Change your confirmed email address"><p>Current login email: <strong>{email}</strong>. This is also the address used for emailed HOA notices when you consent.</p>
    {pendingEmail && <p className="portal-notice">Awaiting confirmation: {pendingEmail}. Your current email remains in use until the change is confirmed.</p>}
    {message && <p role="status" className="portal-notice">{message}</p>}
    <form className="portal-form" onSubmit={update}><label>New email address<input name="new_email" type="email" autoComplete="email" maxLength={254} required /></label><label>Confirm new email address<input name="confirm_email" type="email" autoComplete="off" maxLength={254} required /></label><button disabled={busy}>{busy ? "Please wait…" : "Send email change confirmations"}</button></form>
  </WorkspaceSection>;
}
