// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', "@nuxtjs/tailwindcss"],
  css: ["@/assets/css/common.scss"],
  alias: {
    'tailwindcss/colors': resolve(__dirname, 'utils/tw-colors-runtime.ts'),
  },
  runtimeConfig: {
    lineChannelId: process.env.NUXT_LINE_CHANNEL_ID,
    lineChannelSecret: process.env.NUXT_LINE_CHANNEL_SECRET,
    lineRedirectUri: process.env.NUXT_LINE_REDIRECT_URI,
    public: {
      apiKey: process.env.NUXT_PUBLIC_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_STORAGE_BUCKET,
      databaseURL: process.env.NUXT_PUBLIC_DATABASE_URL,
      liffId: process.env.NUXT_PUBLIC_LIFF_ID,
      liffUseMock: process.env.NUXT_PUBLIC_LIFF_USE_MOCK === 'true',
    },
  },
  vite: {
    server: {
      // ngrok ドメインを許可
      allowedHosts: ['.ngrok-free.app'],
      hmr: {
        host: 'localhost',
      },
    },
  },
})