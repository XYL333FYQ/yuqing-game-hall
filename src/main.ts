import "./styles.css";
import "./themes.css";
import { startPortal } from "./portal/router";
import { installThemeSwitcher } from "./platform/theme";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("页面根节点不存在。");

installThemeSwitcher();
startPortal(app);
