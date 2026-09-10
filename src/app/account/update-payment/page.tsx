"use client";import {BillingCheckout} from "@/components/billing/billing-checkout";import {AccountSettingsShell} from "@/components/account/account-settings-shell";
export default function PaymentRenewPage(){return <AccountSettingsShell heading="Payment / Renew" subheading="Choose a plan and pay securely through PayMongo QR Ph." wide><BillingCheckout/></AccountSettingsShell>}
