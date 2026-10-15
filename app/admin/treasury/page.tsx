import type { Metadata } from "next";
import { Portal } from "../../portal/Portal";
export const metadata:Metadata={title:"Treasury | Plum Creek",robots:{index:false,follow:false}};
export default function TreasuryPage(){return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private leadership workspace</p><h1>Treasury</h1><p>Yearly dues, manual fee assessments, payment receipts and lot balances.</p></section><Portal view="treasury"/></main>;}
