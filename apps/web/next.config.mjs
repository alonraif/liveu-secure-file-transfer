/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@liveu-sft/config"],
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"]
  }
};

export default nextConfig;
