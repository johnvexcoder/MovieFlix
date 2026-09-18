"use client";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { StreamingPreparationAdmin } from "@/components/admin/streaming-preparation";
import { SessionSecuritySettings } from "@/components/admin/session-security-settings";

export default function AdminPlatformPage() {
  return (
    <AdminPage
      title="Platform and Delivery"
      description="Streaming, transcoding, playback packages, and delivery settings."
    >
      <AdminSection>
        <StreamingPreparationAdmin />
        <SessionSecuritySettings />
      </AdminSection>
    </AdminPage>
  );
}