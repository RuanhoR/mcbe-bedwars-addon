import { defineConfig } from "mbler"
export default defineConfig({
  description: '起床战争 mcaddon',
  mcVersion: '1.26.31',
  minify: false,
  script: { main: 'index.ts', ui: true, lang: 'mcx', UseBeta: false },
  build: { bundle: true, cache: "file" },
  outdir: { resources: './dist/res', behavior: './dist/dep', dist: './dist.mcaddon' }
});
