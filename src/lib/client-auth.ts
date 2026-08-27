// Client-side helpers to silently restore sessions via the refresh cookies.
// Access tokens are short-lived (15 min); refresh cookies last 7 days.

export async function refreshUserSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function refreshAdminSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/auth/refresh", {
      method: "POST",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkUserSession(): Promise<boolean> {
  let res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok && (await refreshUserSession())) {
    res = await fetch("/api/auth/me", { cache: "no-store" });
  }
  return res.ok;
}

export async function checkAdminSession(): Promise<boolean> {
  let res = await fetch("/api/admin/auth/me", { cache: "no-store" });
  if (!res.ok && (await refreshAdminSession())) {
    res = await fetch("/api/admin/auth/me", { cache: "no-store" });
  }
  return res.ok;
}