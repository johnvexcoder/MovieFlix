"use client";
import { useState } from "react";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { BroadcastInApp } from "@/components/admin/broadcast-in-app";
import { EmailBroadcastAdmin } from "@/components/admin/email-broadcast";
import { MessageHistory } from "@/components/admin/message-history";

type Channel = "inapp" | "email";

export default function AdminBroadcastPage() {
  const [channel, setChannel] = useState<Channel>("inapp");

  return (
    <AdminPage
      title="Broadcast Email / Message"
      description="Communicate with your audience — in-app announcements and SMTP email are separate channels."
    >
      <div role="tablist" aria-label="Broadcast channels" className="mb-6 flex w-fit gap-1 rounded-2xl border border-white/10 bg-white/5 p-1.5">
        <button role="tab" aria-selected={channel === "inapp"} onClick={() => setChannel("inapp")} className={`min-h-11 rounded-xl px-5 py-2 text-sm font-bold transition ${channel === "inapp" ? "bg-[var(--brand)] text-slate-950" : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}>In-App Message</button>
        <button role="tab" aria-selected={channel === "email"} onClick={() => setChannel("email")} className={`min-h-11 rounded-xl px-5 py-2 text-sm font-bold transition ${channel === "email" ? "bg-[var(--brand)] text-slate-950" : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}>Email</button>
      </div>

      {channel === "inapp" ? (
        <AdminSection>
          <BroadcastInApp />
          <MessageHistory />
        </AdminSection>
      ) : (
        <AdminSection>
          <EmailBroadcastAdmin />
        </AdminSection>
      )}
    </AdminPage>
  );
}