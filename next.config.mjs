/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force the entire app to use Node.js runtime.
  // This is the safest setting when using postgres/drizzle which
  // depend on Node.js built-ins (net, tls, crypto) unavailable in Edge.
  experimental: {
    serverComponentsExternalPackages: [
      "postgres",
      "better-auth",
      "@node-rs/argon2",
      "@node-rs/bcrypt",
    ],
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleapis.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
