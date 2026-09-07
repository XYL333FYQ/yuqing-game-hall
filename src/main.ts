import "./styles.css";
import { startPortal } from "./portal/router";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("页面根节点不存在。");

startPortal(app);
