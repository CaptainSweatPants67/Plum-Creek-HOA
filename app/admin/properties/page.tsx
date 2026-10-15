import type { Metadata } from "next";
import { Portal } from "../../portal/Portal";
export const metadata:Metadata={title:"Property Management | Plum Creek",robots:{index:false,follow:false}};
export default function PropertyManagementPage(){return <main className="portal-app"><section className="portal-page-heading"><p className="section-kicker">Private leadership workspace</p><h1>Property management</h1><p>Manage lot records, verified homeowners, rental status, balances and homeowner notices.</p></section><Portal view="properties"/></main>;}
