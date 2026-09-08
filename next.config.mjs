/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its standard-font AFM data from node_modules at runtime,
  // so it must stay external to the server bundle.
  serverExternalPackages: ["pdfkit"],
  // Hide the floating dev-tools "N" badge during development.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
