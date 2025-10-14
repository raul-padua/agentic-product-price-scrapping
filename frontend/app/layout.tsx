import type { ReactNode } from "react";
import Link from "next/link";
export const metadata = {
  title: "Product Capture App",
  description: "Capture product, price, and promotions screenshots",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", margin: 0, background: "#f2f7fb", color: "#0b2a3d" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 10, background: "#ffffff", borderBottom: "1px solid #cfe3f1" }}>
          <nav style={{ maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px" }}>
            <div style={{ fontWeight: 700 }}>Product Capture</div>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/" style={{ textDecoration: "none", color: "#0b2a3d" }}>Capture</Link>
              <Link href="/search" style={{ textDecoration: "none", color: "#0b2a3d" }}>Research</Link>
            </div>
          </nav>
        </header>
        <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}

