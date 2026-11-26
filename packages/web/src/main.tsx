import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

// 顺序有意义：base 定义 :root 变量，后面的文件引用它们。
import "./styles/base.css";
import "./styles/desktop.css";
import "./styles/apps.css";
import "./styles/screens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("找不到 #root 挂载点");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
