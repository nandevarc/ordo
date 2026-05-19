import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Web3Providers } from "@/components/web3-providers";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-semibold tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to Ordo
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-base font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a
          href="/"
          className="mt-5 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm hover:bg-accent"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Ordo — Batch USDC payments on Arc" },
        {
          name: "description",
          content:
            "Ordo is a batch USDC payment operations tool on Arc Network. Upload a list, preview the cost, execute in one operation.",
        },
        { property: "og:title", content: "Ordo — Batch USDC payments on Arc" },
        {
          property: "og:description",
          content:
            "Batch USDC payment operations on Arc. Upload, preview, execute.",
        },
        { name: "twitter:title", content: "Ordo — Batch USDC payments on Arc" },
        { name: "description", content: "Ordo is a web application for executing bulk USDC payments on the Arc Network." },
        { property: "og:description", content: "Ordo is a web application for executing bulk USDC payments on the Arc Network." },
        { name: "twitter:description", content: "Ordo is a web application for executing bulk USDC payments on the Arc Network." },
        { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/826997d7-2f5f-434f-9aad-94a07c283445/id-preview-282973ec--87666e0a-f55a-4d35-81c6-7dbb435bb584.lovable.app-1779180690463.png" },
        { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/826997d7-2f5f-434f-9aad-94a07c283445/id-preview-282973ec--87666e0a-f55a-4d35-81c6-7dbb435bb584.lovable.app-1779180690463.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:type", content: "website" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Web3Providers>
        <Outlet />
        <Toaster position="top-right" theme="light" />
      </Web3Providers>
    </QueryClientProvider>
  );
}
