"use client";

import { MessageSquareHeart } from "lucide-react";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { ContactForm } from "@/components/account/contact-form";

export default function FeedbackPage() {
  return (
    <AccountSettingsShell heading="Give Feedback" subheading="Share your thoughts on the MovieFlix experience.">
      <ContactForm
        type="feedback"
        icon={<MessageSquareHeart className="h-5 w-5 text-emerald-400" />}
        title="Feedback"
        description="Tell us what you love, what could be better, and what you'd like to see next. Your feedback helps shape MovieFlix."
        subjectPlaceholder="e.g. «Playback quality»"
        messagePlaceholder="Share your feedback about the platform, content, or experience…"
        submitLabel="Send Feedback"
      />
    </AccountSettingsShell>
  );
}