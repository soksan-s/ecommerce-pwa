export default function manifest() {
  return {
    name: "Soeum Savet Store",
    short_name: "Soeum Savet Store",
    description: "Shared PWA for customer shopping, cashier POS, and store operations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2ec",
    theme_color: "#127c73",
    orientation: "portrait-primary",
    categories: ["shopping", "business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
