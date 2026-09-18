"use client";
import { useEffect, type ReactNode } from "react";

/** Sets the document title for an admin page. */
export function useAdminTitle(title: string) {
  useEffect(() => {
    document.title = `MovieFlix Admin – ${title}`;
    return () => {
      document.title = "MovieFlix";
    };
  }, [title]);
}

interface AdminPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Consistent page shell for every admin section. */
export function AdminPage({ title, description, actions, children }: AdminPageProps) {
  useAdminTitle(title);
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{title}</h1>
          {description && <p className="mt-1 text-xs text-neutral-400">{description}</p>}
        </div>
        {actions && <div className="admin-toolbar">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Vertical grouping of related cards/sections with consistent spacing. */
export function AdminSection({ children }: { children: ReactNode }) {
  return <div className="admin-section">{children}</div>;
}