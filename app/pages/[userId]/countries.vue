<script setup lang="ts">
import { ref } from "vue";
import { useCountries } from "~/composables/useCountries";

const { countries } = useCountries();
const cuisine = ref("日本");
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-white to-gray-50 py-12 px-6">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-extrabold text-center text-gray-800 mb-10">
        🌍 作りたい料理の国を選択してください
      </h2>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button
          v-for="country in countries"
          :key="country.label"
          @click="cuisine = country.label"
          class="flex flex-col items-center justify-center px-4 py-3 rounded-xl border shadow-sm transition-all duration-200"
          :class="cuisine === country.label
            ? 'bg-green-500 text-white scale-105'
            : 'bg-white hover:bg-gray-100 text-gray-800'"
        >
         <img :src="`https://flagcdn.com/w80/${country.code.toLowerCase()}.png`" />


          <span class="text-sm font-medium text-center">{{ country.label }}</span>
        </button>
      </div>

      <div class="text-center mt-10">
        <p class="text-gray-600 text-lg">
          選択中の国：<span class="font-bold text-green-600">{{ cuisine }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
