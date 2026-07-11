import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clubtech — Your venue, pre-sold",
  description: "The booking and revenue operations platform for premium venues.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
