import type { Metadata } from "next";
import { LabClient } from "@/components/lab/LabClient";

export const metadata: Metadata = { title: "Labo RSA — CIPHER//LAB" };

export default function LabPage() {
  return <LabClient />;
}
