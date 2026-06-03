import type { Metadata } from "next";
import "./globals.css";
import { BfcacheRecovery } from "@/components/BfcacheRecovery";

export const metadata: Metadata = {
  title: "Racket Bracket",
  description: "Private Grand Slam tennis brackets for friend groups."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BfcacheRecovery />
        {children}
      </body>
    </html>
  );
}
