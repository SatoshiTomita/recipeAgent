// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/favicon.png' } 
      ],
      meta: [
        { name: 'description', content: 'Recipe Agent - AIでレシピを生成するアプリ' },
        { property: 'og:title', content: 'Recipe Agent' },
        { property: 'og:description', content: '手持ちの食材でレシピを自動生成します' },
        { property: 'og:image', content: 'https://firebasestorage.googleapis.com/v0/b/recipeagent-cff98.firebasestorage.app/o/uploads%2FChatGPT%20Image%202025%E5%B9%B48%E6%9C%8830%E6%97%A5%2010_10_42.png?alt=media&token=64f62a6e-1832-4de4-ad2a-e07261731105' },
        { property: 'og:url', content: 'https://recipe-agent.vercel.app' },
        { name: 'twitter:card', content: 'summary_large_image' }
      ],
      title: 'Recipe Agent',
    }
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui', "@nuxtjs/tailwindcss"],
  css: ["@/assets/css/common.scss"],
  alias: {
    'tailwindcss/colors': resolve(__dirname, 'utils/tw-colors-runtime.ts'),
  },
  runtimeConfig: {
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
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
      allowedHosts: ['.ngrok-free.app','.trycloudflare.com'],
      hmr: {
        host: 'localhost',
      },
    },
  },
})