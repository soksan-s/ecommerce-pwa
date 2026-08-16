import "./globals.css";
import { AppStoreProvider } from "@/components/app-store-provider";
import { PwaProvider } from "@/components/pwa-provider";

export const metadata = {
  title: {
    default: "MyShop — Premium Store, POS & Delivery",
    template: "%s | MyShop",
  },
  description: "Shop premium products online, or visit our store. Fast delivery, secure checkout.",
  applicationName: "MyShop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "MyShop",
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
