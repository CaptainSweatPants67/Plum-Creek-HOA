"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { LeadershipManager } from "./LeadershipManager";
import { MemberWorkspace } from "./MemberWorkspace";
import { StaffWorkspace } from "./StaffWorkspace";

type Flags = { is_admin: boolean; is_director: boolean; is_officer: boolean; has_mfa: boolean; can_view_signup_code: boolean; can_manage_leadership: boolean };
type Code = { passcode: string; enabled: boolean; updated_at: string };

export function Portal({ view = "portal" }: { view?: "portal" | "members" | "admin" }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [code, setCode] = useState<Code | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    // Forward older email callbacks before Supabase consumes their URL fragment.
    const forwardRecovery = () => {
      const callback = new URLSearchParams(window.location.hash.slice(1));
      if (callback.get("type") !== "recovery") return false;
      window.location.replace(`/portal/reset-password/${window.location.search}${window.location.hash}`);
      return true;
    };
    if (forwardRecovery()) return;
    window.addEventListener("hashchange", forwardRecovery);
    const client = getSupabaseBrowserClient();
    let active = true;
    if (!client) {
      void Promise.resolve().then(() => { if (active) setAuthReady(true); });
      return () => { active = false; window.removeEventListener("hashchange", forwardRecovery); };
    }
    void (async () => {
      const initialized = await client.auth.initialize();
      const { data } = await client.auth.getSession();
      if (active) {
        setClient(client); setSession(data.session); setAuthReady(true);
        if (initialized.error) setMessage("This email link has expired or is invalid. Please request a new link.");
      }
    })();
    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") window.location.assign("/portal/reset-password/");
      if (!next) { setFlags(null); setCode(null); setQr(""); setFactorId(""); }
    });
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener("hashchange", forwardRecovery); };
  }, []);
  useEffect(() => {
    if (!client || !session) return;
    let active = true;
    void client.rpc("get_portal_flags").then(({ data, error }) => {
      if (!active) return;
      if (error) { setFlags(null); setCode(null); setMessage("Portal permissions could not be loaded. Please try again."); }
      else { const next = data as Flags; setFlags(next); if (!next.can_view_signup_code) setCode(null); }
    });
    return () => { active = false; };
  }, [client, session]);

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const passcode = String(values.get("passcode") ?? "");
    setBusy(true); setMessage("");
    try {
      if (mode === "signup") {
        let ticket: string | undefined;
        if (passcode.trim()) {
          const result = await client.rpc("request_homeowner_signup_ticket", { p_email: email, p_passcode: passcode });
          if (result.error || result.data?.error) throw new Error(result.data?.error ?? "Unable to validate the signup passcode.");
          ticket = result.data.ticket;
        }
        const { error } = await client.auth.signUp({ email, password, options: {
          emailRedirectTo: `${window.location.origin}/portal/`, data: ticket ? { signup_ticket: ticket } : {},
        } });
        if (error) throw new Error("Registration could not be completed. Check your signup passcode or contact the HOA.");
        form.reset(); setMessage("Check your email to confirm your account. Registration does not verify property ownership.");
      } else if (mode === "recovery") {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/portal/reset-password/` });
        if (error) throw error;
        setMessage("If an account exists for that email, a password reset link will be sent.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        form.reset();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function beginMfa() {
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const existing = factors.data.totp[0];
      if (existing) { setFactorId(existing.id); setQr(""); }
      else {
        // Remove abandoned unverified TOTP enrollments before starting another.
        for (const factor of factors.data.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
          const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (removed.error) throw removed.error;
        }
        const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Plum Creek leadership" });
        if (result.error) throw result.error;
        setFactorId(result.data.id); setQr(result.data.totp.qr_code);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "MFA setup failed."); }
    finally { setBusy(false); }
  }
  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client) return;
    const token = String(new FormData(event.currentTarget).get("mfa_code"));
    setBusy(true); setMessage("");
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: token });
      if (error) throw error;
      setFactorId(""); setQr(""); setMessage("MFA verified.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  async function showCode() {
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.rpc("get_homeowner_signup_passcode");
      if (error) { setCode(null); throw new Error("Current Director or Officer authorization with MFA is required."); }
      setCode(data as Code);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load passcode."); }
    finally { setBusy(false); }
  }
  async function rotateCode() {
    if (!client || !window.confirm("Replace the homeowner signup passcode? The previous passcode and unused signup tickets will stop working.")) return;
    setBusy(true); setCode(null); setMessage("");
    const { error } = await client.rpc("rotate_homeowner_signup_passcode");
    setBusy(false);
    if (error) setMessage("Only an administrator with MFA can rotate the passcode.");
    else setMessage("The signup passcode has been replaced. Select Show to view it.");
  }

  if (!authReady) return <section className="portal-section"><p role="status">Loading your account…</p></section>;
  if (!client) return <section className="portal-section"><p>Portal setup is in progress. Please contact the HOA for access.</p></section>;
  const leadership = flags && (flags.is_admin || flags.is_director || flags.is_officer);
  return <section className="portal-section">
    {message && <p className="portal-notice" role="status">{message}</p>}
    {!session ? <div className="portal-panel">
      <div className="portal-tabs"><button onClick={() => setMode("login")}>Sign in</button><button onClick={() => setMode("signup")}>Create account</button><button onClick={() => setMode("recovery")}>Reset password</button></div>
      <h2>{mode === "signup" ? "Create your homeowner account" : mode === "recovery" ? "Reset your password" : "Sign in"}</h2>
      <form onSubmit={submitAccount} className="portal-form">
        <label>Current email<input name="email" type="email" autoComplete="email" required /></label>
        {mode !== "recovery" && <label>Password<input name="password" type="password" minLength={mode === "login" ? undefined : 12} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>}
        {mode === "signup" && <><label>Homeowner signup passcode<input name="passcode" autoComplete="off" type="password" /></label>
          <p>Ask a Director or Officer for the signup passcode. The designated first administrator can create their initial account without it.</p>
          <p>Email confirmation and separate property approval are required. Historical contact records do not grant access.</p></>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "recovery" ? "Send reset link" : "Sign in"}</button>
      </form>
    </div> : <>
      <div className="portal-panel"><div className="portal-heading"><h2>Your account</h2><button onClick={async () => { await client.auth.signOut(); setCode(null); setMessage(""); }}>Sign out</button></div>
        <p>{session.user.email}</p>
        {flags && <div className="portal-badges">{flags.is_director && <span>Director</span>}{flags.is_officer && <span>Officer</span>}{flags.is_admin && <span>System administrator</span>}</div>}
        <p>Property access depends on separately approved ownership requests.</p>
        <div className="portal-links"><Link href="/members/">My information and properties →</Link><Link href="/portal/reset-password/">Change your password →</Link>{leadership && <Link href="/admin/">Leadership administration →</Link>}</div>
      </div>
      {leadership && !flags.has_mfa && <div className="portal-panel"><h2>Verify your leadership login</h2><p>MFA is required to view the homeowner signup passcode or manage appointments.</p>
        {!factorId && <button onClick={beginMfa} disabled={busy}>Set up or verify authenticator</button>}
        {qr && <><p>Scan this QR code with your authenticator app.</p><Image src={qr} alt="Your authenticator enrollment QR code" width={220} height={220} unoptimized /></>}
        {factorId && <form className="portal-form" onSubmit={verifyMfa}><label>Authenticator code<input name="mfa_code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button disabled={busy}>Verify MFA</button></form>}
      </div>}
      {flags?.can_view_signup_code && <div className="portal-panel"><h2>Homeowner signup passcode</h2><p>Share this code with homeowners who want to register. It grants registration only; ownership approval is separate.</p>
        <div className="portal-actions"><button disabled={busy} onClick={showCode}>Show signup passcode</button>{code && <button onClick={() => setCode(null)}>Hide passcode</button>}{flags.is_admin && <button disabled={busy} onClick={rotateCode}>Replace passcode</button>}</div>
        {code && <div className="portal-code"><strong>{code.passcode}</strong><p>{code.enabled ? "Registration code is active." : "Registration code is disabled."}</p></div>}
      </div>}
      {view === "members" && <MemberWorkspace key={session.user.id} client={client} userId={session.user.id} email={session.user.email ?? ""} />}
      {view === "admin" && flags?.can_view_signup_code && <StaffWorkspace key={session.user.id} client={client} userId={session.user.id} />}
      {view === "admin" && flags?.can_manage_leadership && <LeadershipManager key={session.user.id} client={client} />}
      {view === "admin" && flags && !leadership && <div className="portal-panel"><h2>Leadership access required</h2><p>This page is available to assigned Directors, Officers, and system administrators. You can manage your own information on the member page.</p></div>}
    </>}
  </section>;
}
