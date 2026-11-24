import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // 产物直接落到仓库根的 public/，随二进制分发。
  // 这样 bun compile 时能把它一起打包，不用额外拷贝。
  build: {
    outDir: resolve(import.meta.dirname, "../../public"),
    emptyOutDir: true,
  },
  server: {
    // 开发时把 API 请求转给后端，避免 CORS 和端口困扰。
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5090",
        changeOrigin: true,
      },
    },
  },
});
