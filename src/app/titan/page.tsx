import type { Metadata } from "next";
import { TitanClient } from "@/components/titan/TitanClient";

export const metadata: Metadata = { title: "Défi Titan — CIPHER//LAB" };

export default function TitanPage() {
  return <TitanClient />;
}
