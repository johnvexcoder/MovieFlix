import type { ReactNode } from "react";

interface SettingRowProps {
  title: string;
  description?: string;
  value?: ReactNode;
  action?: ReactNode;
}

/** A single settings row: label/description on the left, value/action on the right. */
export function SettingRow({ title, description, value, action }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        {description && <p className="mt-0.5 text-xs text-neutral-400">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {value && <span className="text-sm text-neutral-300">{value}</span>}
        {action}
      </div>
    </div>
  );
}

/** A grouped settings panel: title, description, divider, rows. */
export function SettingsGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-neutral-400">{description}</p>}
      </div>
      <div className="divide-y divide-white/8">{children}</div>
    </section>
  );
}