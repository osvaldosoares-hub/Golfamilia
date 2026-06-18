/** @type {import('next').NextConfig} */
const getAllowedOrigins = () => {
  const origins = ['localhost:3000']
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      origins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).host)
    }
  } catch {
    // ignore invalid URL
  }
  return origins
}

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
  // Aumenta o timeout estático para evitar timeout em cold starts
  staticPageGenerationTimeout: 120,
}

module.exports = nextConfig