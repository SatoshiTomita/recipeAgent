<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
</script>

<template>
  <!-- ローディング -->
  <div class="fixed inset-0 z-20 flex items-center justify-center bg-black/80">
    <div class="flex flex-col items-center gap-2 p-5 text-white">
      <LoaderCircle class="animate-spin" :size="40" :stroke-width="2" />
      <p class="text-sm">Loading ...</p>
    </div>
  </div>
</template>
