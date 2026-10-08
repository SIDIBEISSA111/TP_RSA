"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  // Le chat occupe tout l'écran, comme une application de messagerie
  if (usePathname().startsWith("/chat")) return null;
  return (
    <footer className="border-t border-line px-4 py-5 text-center text-xs text-mute">
      CIPHER//LAB · projet de cryptographie · le chiffrement et le déchiffrement s&apos;exécutent dans votre navigateur
    </footer>
  );
}
