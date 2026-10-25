import "./styles/index.css";
import { startPortal } from "./shell/router";
import { installThemeSwitcher } from "./appearance/theme";
import { finishEntry } from "./appearance/entry";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("页面根节点不存在。");

installThemeSwitcher();
void startPortal(app).finally(finishEntry);
