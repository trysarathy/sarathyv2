/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['groq-sdk', '@finverse/sdk-typescript', 'web-push'],
  },
}

export default nextConfig
