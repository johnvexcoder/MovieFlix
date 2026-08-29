"use client";

import { AlertTriangle } from "lucide-react";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { ContactForm } from "@/components/account/contact-form";

export default function ReportPage() {
  return (
    <AccountSettingsShell heading="Report a Problem" subheading="Something not working? Let us know and we'll look into it.">
      <ContactForm
        type="report"
        icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
        title="Report an Issue"
        description="Found a bug, playback problem, or broken feature? Describe what happened below and our team will investigate."
        subjectPlaceholder="e.g. «Video won't play»"
        messagePlaceholder="Tell us what happened, what you were doing, and any error messages you saw…"
        submitLabel="Submit Report"
      />
    </AccountSettingsShell>
  );
}