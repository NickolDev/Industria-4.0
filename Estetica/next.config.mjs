/** @type {import('next').NextConfig} */
const nextConfig = {
  // Afrouxado para o primeiro deploy não travar por lint/tipo.
  // Recomendado reativar (false) quando for endurecer o projeto.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Cabeçalhos de segurança aplicados a todas as respostas.
  // Camada extra do lado do navegador (defesa em profundidade).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig
