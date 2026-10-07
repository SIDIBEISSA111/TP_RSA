import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CIPHER//LAB — Laboratoire de cryptographie RSA",
  description:
    "Générez des clés RSA, chiffrez et déchiffrez des messages, et relevez le défi TITAN : deux nombres premiers de plus d'un million de chiffres.",
};

export const viewport: Viewport = {
  themeColor: "#03060a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${jetbrains.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-5 text-center text-xs text-mute">
          CIPHER//LAB · projet de cryptographie · tous les calculs s&apos;exécutent dans votre navigateur
        </footer>
      </body>
    </html>
  );
}
