"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { LeadershipManager } from "./LeadershipManager";
import { MemberWorkspace } from "./MemberWorkspace";
import { StaffWorkspace } from "./StaffWorkspace";
import { LeadershipRecords } from "./LeadershipRecords";
import { MemberLibrary } from "./MemberLibrary";
import { MemberResources } from "./MemberResources";
import { SectionControls } from "./WorkspaceSection";
import { SignupPasscode } from "./SignupPasscode";
import { RentalWorkspace } from "./RentalWorkspace";
import { MemberAccessGate } from "./MemberAccessGate";
import { CalendarManager } from "./CalendarManager";
import { PropertyHouseholds } from "./PropertyHouseholds";

type Flags = { is_admin: boolean; is_director: boolean; is_officer: boolean; has_mfa: boolean; can_view_signup_code: boolean; can_manage_leadership: boolean };

export function Portal({ view = "portal" }: { view?: "portal" | "members" | "admin" | "leadership" | "documents" }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rentalRevision, setRentalRevision] = useState(0);
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
      if (!next) { setFlags(null); setQr(""); setFactorId(""); }
    });
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener("hashchange", forwardRecovery); };
  }, []);
  useEffect(() => {
    if (!client || !session) return;
    let active = true;
    void client.rpc("get_portal_flags").then(({ data, error }) => {
      if (!active) return;
      if (error) { setFlags(null); setMessage("Portal permissions could not be loaded. Please try again."); }
      else { setFlags(data as Flags); }
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
      <div className="portal-panel portal-account"><div className="portal-heading"><div><span className="signed-in-label">● Signed in</span><p>{session.user.email}</p></div><button onClick={async () => { await client.auth.signOut(); setMessage(""); }}>Sign out</button></div>
        {flags && <div className="portal-badges">{flags.is_director && <span>Director</span>}{flags.is_officer && <span>Officer</span>}{flags.is_admin && <span>System administrator</span>}</div>}
        <nav className="portal-links" aria-label="Member workspace"><Link aria-current={view === "members" ? "page" : undefined} href="/members/">My information &amp; properties</Link><Link aria-current={view === "documents" ? "page" : undefined} href="/member-documents/">Member library</Link>{leadership && <Link aria-current={view === "admin" ? "page" : undefined} href="/admin/">HOA administration</Link>}{(flags?.is_director || flags?.is_officer) && <Link aria-current={view === "leadership" ? "page" : undefined} href="/leadership/">Officer &amp; Director tools</Link>}<Link href="/portal/reset-password/">Password</Link></nav>
      </div>
      <SectionControls />
      {leadership && !flags.has_mfa && <div className="portal-panel"><h2>Verify your leadership login</h2><p>MFA is required to view the homeowner signup passcode or manage appointments.</p>
        {!factorId && <button onClick={beginMfa} disabled={busy}>Set up or verify authenticator</button>}
        {qr && <><p>Scan this QR code with your authenticator app.</p><Image src={qr} alt="Your authenticator enrollment QR code" width={220} height={220} unoptimized /></>}
        {factorId && <form className="portal-form" onSubmit={verifyMfa}><label>Authenticator code<input name="mfa_code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button disabled={busy}>Verify MFA</button></form>}
      </div>}
      {flags?.can_view_signup_code && view === "admin" && <SignupPasscode key={`signup-code-${session.user.id}`} client={client} canReplace={flags.can_manage_leadership} />}
      {view === "members" && <MemberWorkspace key={`members-${session.user.id}`} client={client} userId={session.user.id} email={session.user.email ?? ""} />}
      {view === "documents" && <MemberAccessGate key={`access-${session.user.id}`} client={client}><MemberResources key={`resources-${session.user.id}`} client={client} /><MemberLibrary key={`library-${session.user.id}`} client={client} /></MemberAccessGate>}
      {view === "leadership" && flags?.has_mfa && (flags.is_director || flags.is_officer) && <LeadershipRecords key={`records-${session.user.id}`} client={client} />}
      {view === "leadership" && flags && !flags.is_director && !flags.is_officer && <div className="portal-panel"><h2>Director or Officer access required</h2><p>This workspace is for currently appointed Directors and Officers. Members can read published minutes and announcements.</p><Link href="/member-documents/">Read member updates →</Link></div>}
      {view === "admin" && flags?.can_manage_leadership && <LeadershipManager key={`leadership-${session.user.id}`} client={client} />}
      {view === "admin" && flags?.can_view_signup_code && <StaffWorkspace key={`staff-${session.user.id}`} client={client} userId={session.user.id} onChanged={() => setRentalRevision(v => v + 1)} />}
      {view === "admin" && flags?.can_view_signup_code && <RentalWorkspace key={`rental-staff-${session.user.id}`} client={client} staff revision={rentalRevision} />}
      {view === "admin" && flags?.can_view_signup_code && <PropertyHouseholds key={`households-staff-${session.user.id}`} client={client} staff revision={rentalRevision} />}
      {view === "admin" && flags?.can_view_signup_code && <CalendarManager key={`calendar-staff-${session.user.id}`} client={client} defaultOpen={false} />}
      {view === "admin" && flags && !leadership && <div className="portal-panel"><h2>Leadership access required</h2><p>This page is available to assigned Directors, Officers, and system administrators. You can manage your own information on the member page.</p></div>}
    </>}
  </section>;
}
