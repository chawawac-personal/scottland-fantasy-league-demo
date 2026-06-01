import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Restrict to known trusted image origins only.
    // A wildcard hostname ("**") allows the image optimizer to proxy any URL,
    // which is an SSRF vector and an abuse pathway.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hinnvqadajjmoouvsuad.supabase.co", // Supabase Storage
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
    ],
  },
};

export default nextConfig;
