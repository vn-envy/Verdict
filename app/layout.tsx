import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Neural OS type system: Space Grotesk for high-impact headers, JetBrains Mono for all
// data/labels (so every string reads like a line of executable code).
const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "VERDICT // ROOT_ACCESS",
  description: "An adversarial AI jury that adjudicates contested claims — grounded, calibrated, unbiased by construction.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} dark`}>
      <head>
        {/* Material Symbols for terminal/HUD iconography. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
