import Image from "next/image";
export function MemberPageHeading({ title, description }: { title: string; description: string }) {
  return <section className="member-page-hero"><div><p className="section-kicker">Your Plum Creek community</p><h1>{title}</h1><p>{description}</p><span className="member-private-label">Private member portal</span></div><Image src="/plum-creek-entrance.jpg" alt="Plum Creek neighborhood entrance" width={960} height={720} priority unoptimized /></section>;
}
