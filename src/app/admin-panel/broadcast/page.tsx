"use client";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { EmailBroadcastAdmin } from "@/components/admin/email-broadcast";
import { MessageHistory } from "@/components/admin/message-history";

export default function AdminBroadcastPage() {
  return (
    <AdminPage
      title="Broadcast Email / Message"
      description="Compose targeted emails and internal messages to your audience."
    >
      <AdminSection>
        <EmailBroadcastAdmin />
        <MessageHistory />
      </AdminSection>
    </AdminPage>
  );
}