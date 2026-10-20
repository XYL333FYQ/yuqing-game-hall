# 首页视觉重做

用户明确拒绝上一版的信息堆砌、重复卡片和单一背景。目标是让画面、材质、空间关系和实际交互承担首页表达；不以添加文案作为视觉装饰。

## 实现选择
- 首屏只保留当前游戏的类型、标题、一句介绍和操作。移除上一版新增的刊头、事实栏、图注、标签排布。
- 使用独立的透明街机雕塑作为首屏主视觉，真实游戏截图缩为可点击预览，避免文字游戏或空白菜单截图变成整块白墙。该图不随轮播重建。
- 推荐区使用两幅大画面与两幅小画面组成的错落布局；手机改为可横向浏览的画廊。
- 将原体感入口提前到推荐区与游戏库之间，使用独立的玻璃手势主视觉形成材质与深浅对比。
- 游戏库改为透明底封面画廊，常驻游戏名和类型；简介、进入按钮在悬停或键盘聚焦时出现。触屏仍可直接点封面进入详情。
- 初始显示 12 款，按钮可展开全部；搜索、筛选和排序继续从全部候选中计算。搜索按回车直接定位到结果。
- 保留原有的三种加载场景、粒子轨迹、光圈、两道波浪、主题揭幕、进场和悬停效果。未修改 portal 或加载控制器。
- 夜间使用深青与石墨，日间使用白色与浅玉色，粉色以中性色画布搭配深梅色首屏。避免整页被一种主题色填满。

## 素材
- public/platform/gallery/arcade-console.webp：内置 image_gen 生成的透明街机雕塑，1536×1024；保留真实 alpha 编码为 WebP，约 280 KB。
- public/platform/gallery/vision-hand.jpg：内置 image_gen 生成的横幅，2172×724；从原始 PNG 编码为 JPEG，约 191 KB。没有修改生成图的构图。
- public/platform/gallery/*.svg：从 8 张已有矢量封面派生，删除独立的 ARCADE EDITION 文案组与外框，保留图形主体和图形内部标记；视窗改为图形区域。原有游戏资源保持不变。
- src/platform/gallery-art.ts：只被首页使用的素材路径映射。

最终生成提示词（内置工具模式）：

```text
Use case: stylized-concept. Asset type: a premium interactive game-portal banner, panoramic 3:1 landscape, no interface or typography. Create a sculptural studio still life on a deep midnight petrol background (#102725). On the RIGHT TWO THIRDS, a beautifully modelled translucent frosted-glass human hand extends diagonally upward from the lower right, fingers relaxed and naturally reaching toward three small suspended objects: one polished warm coral-orange sphere, one brushed chrome torus and one translucent sea-glass cube. Accurate elegant hand anatomy, tactile fine surface detail, physically plausible refraction and delicate cyan rim light. Subtle caustic light falls onto a dark matte floor. The LEFT THIRD is spacious deep petrol shadow for live website text. Art-directed, sophisticated product photography / high-end 3D rendering, soft large studio lights, quiet cinematic composition and rich material contrast. Use restrained jade, off-white, silver and a single coral accent. No text, no logos, no UI, no frame, no gradients posing as objects, no visual clutter, no sci-fi HUD, no neon bloom, no watermark. Render a polished production-ready wide image.
```

## 验证范围
轮播保留上一个画面并叠化，旧层 inert、aria-hidden 且不接收点击；快速切换最多保留一个旧层，580ms 后清理，路由退出清理计时器。减少动态效果偏好下不创建旧层。

实际浏览器内容视口及测试结果记录在 output/playwright/gallery-acceptance.json。截图为浏览器返回的原比例画面。主观视觉认可仍由用户判断；构建和边界断言不代表视觉认可。

最终验收：三种主题分别检查 1920×1000、1536×864、1366×768、1024×768、900×800、800×900、768×1024、600×900、390×844、320×700、844×390，共 33 组。无页面横向溢出，标题操作、轮播控件和导航均在容器内；游戏预览可见且点击区域超过 44×44 CSS px，雕塑图加载成功且不拦截操作。实际验证鼠标悬停、键盘聚焦、12→56 展开、全量搜索筛选、空结果、详情与返回、轮播暂停和快速叠化清理。平台检查、124 项测试与前端构建通过。

实景截图：output/playwright/gallery-{light-desktop,pink-desktop,middle-desktop,phone-390x844}.png。浏览器截图接口等比返回 1528×859（内容视口 1536×864）和 382×827（内容视口 390×844）；未裁切、拉伸或拼接。全程复用原有 :5173 服务。

街机雕塑最终提示词（内置工具模式）：

```text
Use case: stylized-concept. Asset type: transparent premium arcade website hero sculpture, landscape composition, 3D product still life. One beautifully crafted compact arcade joystick console floating in a three-quarter perspective, shown from slightly above. The console has a thick smoothly chamfered wedge-shaped matte ivory ceramic body, an elegant dark graphite recessed top panel, a brushed chrome rim, one oversized translucent sea-glass jade joystick ball on a short polished metal shaft, and four satisfyingly tactile glass buttons in muted coral, mineral blue, soft jade, and smoky translucent amber. A small sculptural chrome directional cross floats just above and behind the console, accompanied by one translucent sky-blue rounded cube. Precise rich materials, subtle microtexture, believable refraction, delicate studio highlights and soft natural contact shadows on the object itself, high-end industrial design photography with a playful arcade character. Balanced diagonal composition and spacious silhouette, complete objects in frame. Restrained and sophisticated, no neon bloom, no cartoon faces, no busy scene, no typography, no text, no brands or logos, no watermark. Fully transparent background with clean antialiased edges and genuine alpha, no opaque backdrop, no drawn checkerboard. The finished object must feel tangible, refined, and beautifully lit.
```
