import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="/tv-compat.css?v=1" />
        <link rel="icon" href="/logo.svg?v=2" type="image/svg+xml" />
        <link rel="shortcut icon" href="/logo.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.svg?v=2" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
