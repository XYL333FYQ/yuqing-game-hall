# LittleJS Arcade 开发资料

这个目录只保存不应发布给浏览器的开发资料。静态运行包位于 `../../public/games/littlejs-arcade/`，由 Cloudflare Pages 提供并通过 iframe 启动。

`types/littlejs.d.ts` 是 LittleJS 的 TypeScript 声明，仅用于编辑器提示；运行时使用的是静态包内的 JavaScript，因此声明文件不会进入 `dist/`。
