/** @type {import('tailwindcss').Config} */

import * as colors from "tailwindcss/colors";

module.exports = {
  content: [
    "./app.{vue,js,ts,jsx,tsx}",
    "./components/**/*.{vue,js,ts,jsx,tsx}",
    "./layouts/**/*.{vue,js,ts,jsx,tsx}",
    "./app/pages/**/*.{vue,js,ts,jsx,tsx}",
    "./plugins/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        roboto: ["Roboto", "serif"],
      },
      colors: {
        // ブランドカラー
        primary: {
          ...colors.slate,
          DEFAULT: colors.slate[950], // アプリのプライマリーカラー
        },
        secondary: "", // アプリのセカンダリーカラー：未定
        surface: colors.slate[100], // 背景色
        bingo: colors.pink[500], // ビンゴカラー
        reach: colors.yellow[300], // リーチカラー
        // 管理画面ブランドカラー
        "primary-admin": colors.slate[950],
        // システムカラー（エンドユーザーがシステムから受け取るステータス）
        info: colors.blue[500], // インフォメーション
        emergency: colors.red[500], // 緊急・重要
        success: colors.green[500], // 成功
        warning: colors.amber[500], // 警告
        error: colors.red[500], // エラー
        // ボディフォントカラー
        body: colors.slate[950],
        link: colors.blue[500], // テキストリンクカラー
      },
      animation: {
        "fade-out": "fade-out 3s ease both",
        "bounce-out-top": "bounce-out-top 3s ease both",
        "slide-out-right":
          "slide-out-right 3s cubic-bezier(0.550, 0.085, 0.680, 0.530) both",
        "slide-out-left":
          "slide-out-left 3s cubic-bezier(0.550, 0.085, 0.680, 0.530) both",
        "marquee-left": "marquee-left 20s linear infinite",
      },
      keyframes: {
        "fade-out": {
          "0%": {
            opacity: "1",
          },
          to: {
            opacity: "0",
          },
        },
        "bounce-out-top": {
          "0%,15%,38%,70%": {
            transform: "translateY(0)",
            "animation-timing-function": "ease-out",
          },
          "5%": {
            transform: "translateY(-30px)",
            "animation-timing-function": "ease-in",
          },
          "25%": {
            transform: "translateY(-38px)",
            "animation-timing-function": "ease-in",
          },
          "52%": {
            transform: "translateY(-75px)",
            "animation-timing-function": "ease-in",
          },
          "85%": {
            opacity: "1",
          },
          to: {
            transform: "translateY(-800px)",
            opacity: "0",
          },
        },
        "slide-out-right": {
          "0%": {
            transform: "translateX(0)",
            opacity: "1",
          },
          to: {
            transform: "translateX(1000px)",
            opacity: "0",
          },
        },
        "slide-out-left": {
          "0%": {
            transform: "translateX(0)",
            opacity: "1",
          },
          to: {
            transform: "translateX(-1000px)",
            opacity: "0",
          },
        },
        "marquee-left": {
          "0%": {
            transform: "translateX(0)",
          },
          to: {
            transform: "translateX(-100%)",
          },
        },
      },
    },
  },
  plugins: [],
};
