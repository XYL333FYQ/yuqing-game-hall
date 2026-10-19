import "./styles/index.css";
import { startPortal } from "./portal/router";
import { installThemeSwitcher } from "./platform/theme";
import { finishEntry } from "./platform/entry";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("页面根节点不存在。");

installThemeSwitcher();
void startPortal(app).finally(finishEntry);
