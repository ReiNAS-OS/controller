import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react({
      // React Compiler：自动做 memo 化，写代码时不用手写 useMemo/useCallback。
      // 桌面式界面有大量窗口重渲染，手动优化容易漏，交给编译器更稳。
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
  ],
  // 产物直接落到仓库根的 public/，随二进制分发。
  build: {
    outDir: resolve(import.meta.dirname, "../../public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5090",
        changeOrigin: true,
      },
    },
  },
});
