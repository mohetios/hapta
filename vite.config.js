import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // most imports omit the .vue extension
  resolve: { extensions: [".mjs", ".js", ".json", ".vue"] },
  css: { preprocessorOptions: { scss: { silenceDeprecations: ["import"] } } },
  server: { port: 8080, strictPort: true },
});
