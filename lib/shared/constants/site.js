export const appThemes = {
  classic: {
    label: "Classic",
    bodyClassName: "theme-classic",
    badge: "C",
    blast: {
      light: { fill: "#d9eee9", ring: "#127c73" },
      dark: { fill: "#183445", ring: "#127c73" },
    },
  },
  golden: {
    label: "Golden",
    bodyClassName: "theme-golden",
    badge: "G",
    blast: {
      light: { fill: "#f6e2a8", ring: "#c69214" },
      dark: { fill: "#5b4311", ring: "#c69214" },
    },
  },
  pink: {
    label: "Pink",
    bodyClassName: "theme-pink",
    badge: "P",
    blast: {
      light: { fill: "#f8c9de", ring: "#d85a9a" },
      dark: { fill: "#4a2137", ring: "#d85a9a" },
    },
  },
};

export const navItems = [
  { label: "Shop", href: "#shop" },
  { label: "Features", href: "#features" },
  { label: "Admin", href: "#admin" },
  { label: "Architecture", href: "#architecture" },
];

export const featuredProducts = [
  {
    id: "avocado-toast-kit",
    name: "Avocado Toast Kit",
    category: "Fresh Picks",
    description: "A bright breakfast bundle with ripe avocado, seeded loaf, and citrus seasoning.",
    image:
      "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=900&q=80",
    price: 18.5,
    discountPercent: 10,
    rating: 4.8,
  },
  {
    id: "market-box",
    name: "Weekend Market Box",
    category: "Bundles",
    description: "Seasonal produce arranged as a premium delivery box for the home page hero.",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    price: 42,
    discountPercent: 15,
    rating: 4.9,
  },
  {
    id: "berry-mix",
    name: "Berry Energy Mix",
    category: "Snacks",
    description: "Reusable pouch of dried berries, toasted nuts, and dark chocolate fragments.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    price: 12.75,
    discountPercent: 0,
    rating: 4.7,
  },
];

export const clientFeatures = [
  "Public browsing without login, then smooth sign in and register flows",
  "Favorites, cart, orders, profile, support tickets, and coupon prompts",
  "Fast product cards, detail pages, ratings, comments, and image-first browsing",
];

export const adminFeatures = [
  "Dashboard, products, add product, inventory restock, orders, coupons, support inbox",
  "CSV import hooks for products and inventory management",
  "Cloudinary-ready media uploads for images and video assets",
];

export const architectureCards = [
  {
    title: "Frontend",
    description:
      "Next.js app router, React server components first, client components only where interaction needs them.",
  },
  {
    title: "Backend",
    description:
      "RESTful route handlers returning JSON, validated with Zod, kept small and readable for JavaScript teams.",
  },
  {
    title: "Data",
    description:
      "Neon PostgreSQL with Prisma schema for users, products, orders, coupons, favorites, comments, and support.",
  },
  {
    title: "Performance",
    description:
      "Optimized images, static-first pages, minimal client JS, streamed UI, and animation only where it adds value.",
  },
];

export const sdlcPhases = [
  {
    title: "1. Discover",
    description: "Map Flutter screens, data flows, admin needs, and env requirements before feature work.",
  },
  {
    title: "2. Design",
    description: "Define routes, components, theme tokens, REST contracts, and Prisma models in a simple structure.",
  },
  {
    title: "3. Build",
    description: "Implement shared UI, client storefront, admin dashboard, APIs, uploads, and database integration.",
  },
  {
    title: "4. Verify",
    description: "Run lint, build, responsive checks, and core manual flow checks for cart, auth, and admin actions.",
  },
];
