"use client";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { PlanPromoManager } from "@/components/admin/plan-promo-manager";
import { ExpirationReminderSettings } from "@/components/admin/expiration-reminder-settings";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";

export default function AdminMembershipPage() {
  return (
    <AdminPage
      title="Membership and Promotion"
      description="Subscription plans, pricing, promo codes, and expiration rules."
    >
      <AdminSection>
        <PlanPromoManager />
        <PaymentMethodsManager />
        <ExpirationReminderSettings />
      </AdminSection>
    </AdminPage>
  );
}