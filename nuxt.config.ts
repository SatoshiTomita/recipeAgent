// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/ui',"@nuxtjs/tailwindcss"],
  css: ["@/assets/css/common.scss"],
  alias: {
    'tailwindcss/colors': resolve(__dirname, 'utils/tw-colors-runtime.ts'),
  },
   runtimeConfig: {
    public: {
      ENV: process.env[process.env.NODE_ENV + "_" + "ENV"],
      apiKey: process.env[process.env.NODE_ENV + "_" + "apiKey"],
      authDomain: process.env[process.env.NODE_ENV + "_" + "authDomain"],
      projectId: process.env[process.env.NODE_ENV + "_" + "projectId"],
      storageBucket: process.env[process.env.NODE_ENV + "_" + "storageBucket"],
      databaseURL: process.env[process.env.NODE_ENV + "_" + "databaseURL"],
      SENTRY_KEY: process.env.SENTRY_KEY,
      lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    },
  },
})