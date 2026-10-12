import type { Metadata } from "next";
import { ResetPassword } from "./ResetPassword";

export const metadata: Metadata = { title: "Reset your password | Plum Creek", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <main className="portal-app"><section className="portal-page-heading">
    <p className="section-kicker">Private homeowner portal</p><h1>Reset your password</h1>
    <p>Choose a new password for your Plum Creek HOA account.</p>
  </section><ResetPassword /></main>;
}
