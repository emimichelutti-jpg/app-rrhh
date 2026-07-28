/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Configuración de TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 2. Configuración de Turbopack (para silenciar el warning de lockfiles)
  turbopack: {
    root: './',
  },
}

// 3. Integración de Sentry (debe ir al final, envolviendo la configuración)
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  org: "app-rrhh",
  project: "javascript-nextjs",

  // Solo imprimir logs de subida de source maps en CI
  silent: !process.env.CI,

  // Subir un conjunto más grande de source maps para stack traces más limpios
  widenClientFileUpload: true,

  // Instrumentación automática de Vercel Cron Monitors
  automaticVercelMonitors: true,

  // Tree-shaking para reducir el tamaño del bundle
  treeshake: {
    removeDebugLogging: true,
  },
});