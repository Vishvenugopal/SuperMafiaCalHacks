const nextConfig = {
  experimental: { typedRoutes: true },
  env: {
    NEXT_PUBLIC_LIVEKIT_WS_URL: process.env.LIVEKIT_WS_URL,
  }
}
export default nextConfig
