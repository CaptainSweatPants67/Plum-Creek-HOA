"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

export function ResetPassword() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [phase, setPhase] = useState<"loading" | "password" | "request" | "done">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // Opening another email callback while this page is already open is a
    // fragment-only navigation. Start a fresh client to process that link.
    const reloadCallback = () => { if (window.location.hash) window.location.reload(); };
    window.addEventListener("hashchange", reloadCallback);
    const client = getSupabaseBrowserClient();
    // Await URL processing rather than depending on a one-time recovery event.
    void (async () => {
      if (!client) {
        if (active) { setPhase("request"); setMessage("Please contact the HOA for account access."); }
        return;
      }
      const initialized = await client.auth.initialize();
      const { data, error } = await client.auth.getSession();
      if (!active) return;
      setClient(client);
      // Remove callback details only after Supabase has finished reading them.
      window.history.replaceState(null, "", window.location.pathname);
      if (initialized.error || error || !data.session) {
        setPhase("request");
        setMessage("This reset link has expired or is invalid. Request a new link below.");
      } else {
        setPhase("password");
      }
    })();
    return () => { active = false; window.removeEventListener("hashchange", reloadCallback); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    if (phase === "password" && password !== values.get("confirm_password")) {
      setMessage("The passwords do not match. Please enter them again.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      if (phase === "request") {
        const { error } = await client.auth.resetPasswordForEmail(String(values.get("email") ?? "").trim(), {
          redirectTo: `${window.location.origin}/portal/reset-password/`,
        });
        if (error) throw error;
        setMessage("If an account exists for that email, a new password reset link will be sent. Check your inbox.");
      } else if (phase === "password") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        form.reset(); setPhase("done");
        setMessage("Your password has been updated.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="portal-section"><div className="portal-panel">
    {message && <p className="portal-notice" role="status">{message}</p>}
    {phase === "loading" ? <p role="status">Checking your reset link…</p> : phase === "done" ? <Link href="/portal/">Continue to your account →</Link> : <>
      <h2>{phase === "password" ? "Choose a new password" : "Request a new reset link"}</h2>
      <form className="portal-form" onSubmit={submit}>
        {phase === "password" ? <>
          <label>New password<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
          <label>Confirm new password<input name="confirm_password" type="password" minLength={12} autoComplete="new-password" required /></label>
          <p>Use at least 12 characters.</p>
        </> : <label>Current email<input name="email" type="email" autoComplete="email" required /></label>}
        <button type="submit" disabled={busy || !client}>{busy ? "Please wait…" : phase === "password" ? "Update password" : "Send reset link"}</button>
      </form>
      <p><Link href="/portal/">Back to the homeowner portal</Link></p>
    </>}
  </div></section>;
}
