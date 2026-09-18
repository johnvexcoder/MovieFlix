"use client";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { ContactSubmissionsAdmin } from "@/components/admin/contact-submissions";

export default function AdminReportsPage() {
  return (
    <AdminPage
      title="Report & Feedback"
      description="User reports, feedback, and support requests."
    >
      <AdminSection>
        <ContactSubmissionsAdmin />
      </AdminSection>
    </AdminPage>
  );
}