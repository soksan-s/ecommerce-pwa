import "./globals.css";
import { AppStoreProvider } from "@/components/app-store-provider";
import { PwaProvider } from "@/components/pwa-provider";

export const metadata = {
  title: {
    default: "Soeum Savet Store",
    template: "%s | Soeum Savet Store",
  },
  description: "Shop premium products online, or visit our store. Fast delivery, secure checkout.",
  applicationName: "Soeum Savet Store",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Soeum Savet Store",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
    { media: "(prefers-color-scheme: light)", color: "#fafbfa" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-mode="dark">
      <body className="theme-classic antialiased">
        <AppStoreProvider>
          {children}
          <PwaProvider />
        </AppStoreProvider>
      </body>
    </html>
  );
}
