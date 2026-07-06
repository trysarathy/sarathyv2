/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['groq-sdk', '@finverse/sdk-typescript'],
  },
}

export default nextConfig
