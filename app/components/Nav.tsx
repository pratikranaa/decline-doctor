import Link from "next/link";

export default function Nav({ active }: { active?: "home" | "how" | "thesis" | "recovery" }) {
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        <span className="nav-logo">🩺</span>
        Decline Doctor
      </Link>
      <Link href="/" className={`nav-link ${active === "home" ? "active" : ""}`}>
        Try it
      </Link>
      <Link href="/recovery" className={`nav-link ${active === "recovery" ? "active" : ""}`}>
        Console
      </Link>
      <Link href="/how-it-works" className={`nav-link ${active === "how" ? "active" : ""}`}>
        How it works
      </Link>
      <Link href="/thesis" className={`nav-link ${active === "thesis" ? "active" : ""}`}>
        Thesis
      </Link>
    </nav>
  );
}
