import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { SessionKeeper } from "@/components/session-keeper";
import { TvModeBridge } from "@/components/tv-mode";
import { AppErrorBoundary } from "@/components/app-error-boundary";

export const metadata: Metadata = {
  title: {
    default: "MovieFlix - Stream Movies & TV Series",
    template: "%s | MovieFlix",
  },
  description: "Self-hosted, private cinema and media streaming platform.",
  icons: {
    icon: [{ url: "/logo.svg?v=2", type: "image/svg+xml" }],
    shortcut: "/logo.svg?v=2",
    apple: "/logo.svg?v=2",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// White-screen sentinel: if React fails to mount (the classic Smart TV
// failure mode) within BOOT_TIMEOUT_MS, replace the blank page with plain,
// dependency-free diagnostics. TvModeBridge sets __MOVIEFLIX_READY__ after it
// hydrates, which clears the timeout path.
const BOOT_SENTINEL_SCRIPT = `(function(){
  var d = document;
  function show(){
    var box = d.getElementById("mvf-diagnostics");
    if (!box) return;
    box.style.display = "flex";
  }
  var shown = false;
  function check(){
    if (shown) return;
    if (window.__MOVIEFLIX_READY__) return;
    shown = true;
    show();
  }
  setTimeout(check, 9000);
  window.__MOVIEFLIX_BOOT_CHECK__ = check;
})();`;

const BOOT_DIAGNOSTICS_HTML = `(function(){
  var d = document;
  var box = d.createElement("div");
  box.id = "mvf-diagnostics";
  box.setAttribute("role", "alert");
  box.style.cssText = "position:fixed;inset:0;z-index:999999;display:none;align-items:center;justify-content:center;padding:24px;background:#020611;color:#fff;font-family:Arial,Helvetica,sans-serif;text-align:center;";
  var inner = d.createElement("div");
  inner.style.cssText = "max-width:640px;width:100%;";
  var title = d.createElement("div");
  title.textContent = "MovieFlix could not start";
  title.style.cssText = "font-size:28px;font-weight:800;margin-bottom:14px;";
  var body = d.createElement("p");
  body.textContent = "The app did not finish loading. This usually happens on older Smart TV web browsers that miss required web features.";
  body.style.cssText = "font-size:15px;line-height:1.5;color:#9ca3af;margin:0 0 18px;";
  var reload = d.createElement("button");
  reload.type = "button";
  reload.textContent = "\u21bb Reload";
  reload.style.cssText = "min-height:46px;padding:10px 22px;border-radius:999px;border:1px solid #00d2f5;background:#00d2f5;color:#03111e;font-size:15px;font-weight:700;cursor:pointer;";
  reload.addEventListener("click", function(){ window.location.reload(); });
  inner.appendChild(title);
  inner.appendChild(body);
  inner.appendChild(reload);
  box.appendChild(inner);
  d.body.appendChild(box);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="/tv-compat.css?v=3" />
        {/* Compatibility polyfills must execute before the application bundle on older TV browsers. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/legacy-polyfills.js?v=2" />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SENTINEL_SCRIPT }} />
        <link rel="icon" href="/logo.svg?v=2" type="image/svg+xml" />
        <link rel="shortcut icon" href="/logo.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.svg?v=2" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <noscript>
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#020611", color: "#fff", textAlign: "center", padding: 24 }} role="alert">
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
                MovieFlix needs JavaScript
              </div>
              <div style={{ color: "#9ca3af", fontSize: 15 }}>
                The media player and sign-in require a modern browser with JavaScript enabled.
              </div>
            </div>
          </div>
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: BOOT_DIAGNOSTICS_HTML }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionKeeper />
          <TvModeBridge />
          <AppErrorBoundary>
            <TooltipProvider>{children}</TooltipProvider>
          </AppErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}