/**
 * Vite 配置。dev 和生产构建共用这一份。
 *
 * **为什么 dev 和 build 必须是同一个打包器**：两套打包器（Bun 打包 + Vite
 * dev）会有行为漂移——dev 里能跑的 JSX 语法、CSS 处理、别名解析、tree-shake
 * 结果都可能和产物不一致。表现是"本地好好的，构建出来白屏"。所以这里的
 * server 和 build 段落配置对齐，唯一的差别是 HMR 和压缩。
 *
 * 构建产物落到本包的 dist/，由 apps/cli 的构建脚本内联进二进制。产物必须
 * 在包目录内——turbo 只缓存包目录下的 outputs，落到仓库根时缓存命中不恢复
 * 文件，会编出没有界面的二进制（见 docs/decisions.md D-003）。
 */

import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * 后端地址。
 *
 * dev 时前端和后端可能不在同一台机器上——典型场景是前端跑在宿主机 macOS、
 * 后端跑在 Linux 虚机里（面板大量功能要调 lsblk / btrfs / useradd，macOS
 * 上这些根本不存在）。这时用 REINAS_API_TARGET 指定后端地址。
 *
 * 不设时默认同源（127.0.0.1:5090），也就是前后端跑在同一台机器上。
 */
const apiTarget = process.env["REINAS_API_TARGET"];

/** 包根。vite.config.ts 自己所在的目录。 */
const pkgRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // 包根。index.html 在这里，src/ 和它同级。
  root: pkgRoot,
  plugins: [react()],

  resolve: {
    alias: {
      // 和 tsconfig 的 paths 对齐。oxlint 的 no-restricted-imports 禁了
      // `../` 跨目录相对路径，包内引用走这个别名。
      "~": resolve(pkgRoot, "../.."),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",

    // 文件监听。
    //
    // usePolling 默认关闭，因为轮询吃 CPU。但源码在共享文件系统上时
    // inotify 事件根本不来（9p / vboxsf / NFS 都不投递，实测过），必须
    // 退回轮询。300ms 是折中：再短 CPU 占用明显上升，再长手感变钝。
    watch: {
      usePolling: true,
      interval: 300,
      // node_modules 和产物目录不用看，省掉大量 stat
      ignored: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"],
    },

    // 后端请求转发。前端只认 "/api/..."，由 Vite 转给真实后端。
    // 这样前端代码里不需要知道后端在哪，生产的同源假设也成立。
    proxy: apiTarget
      ? {
          "/api": {
            target: apiTarget,
            changeOrigin: true,
          },
        }
      : undefined,
  },

  build: {
    // 产物给 apps/cli 内联进二进制用
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    // 单二进制里不需要 sourcemap，反而会让体积翻倍
    sourcemap: false,
    // Vite 8 默认用 oxc 压缩。不要写 "esbuild"——那要求单独装 esbuild，
    // 而 Vite 8 已经不用它了（报 transformWithEsbuild deprecated）。
    minify: true,
    // 资源内联阈值调大：镜像体积有限，小图标之类的直接进 CSS/JS，
    // 少几个散碎文件，二进制里也少几段。
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: {
        // 产物布局要和 server 的静态服务对齐：
        //   index.html + assets/*.js|css
        // 生产时 Elysia 按这个结构找文件。
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
