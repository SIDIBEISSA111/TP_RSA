import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";

export const metadata: Metadata = { title: "Réseau chiffré — CIPHER//LAB" };

export default function ChatPage() {
  return <ChatApp />;
}
