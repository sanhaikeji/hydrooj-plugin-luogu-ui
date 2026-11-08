# hydrooj-plugin-luogu-ui

HydroOJ 的**洛谷式布局插件**：把 ui-default 默认的顶部横排导航，改成「左侧图标功能栏 + 顶栏 + 右上角头像」，用户菜单改为点击头像后**从右侧滑出**。

纯前端 DOM 重排。**不注册后端路由、不读写数据库、不覆盖任何主题模板、不改任何页面内容**——题目列表、题目详情、比赛页等仍是 Hydro 自己的原模板原样。菜单条目全部搬用 Hydro 自身渲染的原节点，不重写、不克隆。

## 效果

- **左侧功能栏**：默认 64px 只显图标，鼠标悬浮平滑展开到 240px 显示文字（不挤动正文）；窄屏（≤1000px）走汉堡浮层。
- **点选图标动效**：12 个图标各有专属像素级微动效，图标整体 + 内部子形状（门 / 文字行 / 把手 / 柱子 / 波形 / 圆点…）分别按各自节奏运动。支持 `prefers-reduced-motion`。
- **顶栏**：页面标题 + 域 / 语言切换 + **消息按钮** + 头像。消息按钮是把用户菜单里「我的消息」那一条搬到顶栏（链接与文案沿用 Hydro 原节点，带未读红点），抽屉里不再重复。
- **头像点击 → 右侧抽屉**：从屏幕右缘向左滑出，顶部是头像 + 昵称 + 关闭按钮，下面竖排 Hydro 原菜单；遮罩 / × / Esc 均可收起。
- **安全回退**：任何初始化异常自动加 `html.lgui-failed` 恢复默认布局；无导航页（登录 / 注册等）自动跳过；禁用 JS 时原布局完整可用。

## 安装（生产模式，零编译）

```bash
# 1. 把整个插件文件夹放到服务器，例如 /root/
# 2. 注册插件
hydrooj addon add /root/hydrooj-plugin-luogu-ui
# 3. 重启生效（pm2 部署）
pm2 restart hydrooj
```

卸载：

```bash
hydrooj addon remove hydrooj-plugin-luogu-ui
pm2 restart hydrooj
```

> 若重启后样式未生效，说明该版本没有自动重建 `entry.js`，进 `/root/Hydro` 跑一次 `yarn build:ui:production` 即可。

## 实现机制

严格按 Hydro 官方插件文档「使用 TypeScript 编写插件」的 `frontend` 章节：

- `frontend/*.page.ts` 被 UI 构建器自动打包进全站 `entry.js`，每页加载执行；
- `import './luogu-ui.css'` 由构建器自动注入页面 `<head>`；
- `addPage(new AutoloadPage(...))` 在每页 DOM 就绪后调用 `window.LGUI.mount()`；
- 插件注册进 `~/.hydro/addon.json`，安装完必须重启 hydrooj。

参考：Hydro 官方文档 <https://docs.hydro.ac/zh/docs/Hydro/dev/typescript>、<https://docs.hydro.ac/zh/docs/Hydro/plugins>；构建器源码 `packages/ui-default/backendlib/builder.ts`。Hydro-Acrylic / Hydro-Sakura 等布局插件使用同一机制。

## 目录结构

```
hydrooj-plugin-luogu-ui/
├── package.json                  插件包描述
├── index.ts                      后端入口（保留 apply，无后端逻辑）
├── README.md
├── frontend/
│   ├── luogu-ui.page.ts          前端入口（AutoloadPage）
│   ├── luogu-ui.css              布局样式 + 图标专属动效
│   └── luogu-ui.js               DOM 重排核心
└── preview/
    └── luogu-ui-demo.html        本地预览页（见下方说明）
```

## 兼容性与已规避的坑

| 坑 | 处理 |
|---|---|
| 路由有两代：`/p` / `discuss`（现行）与 `/problem` / `discussion`（旧版） | 图标映射用原始 `href` 属性匹配，两套都兼容，并处理 `url_prefix` |
| tether-drop 初始化时会把 `#menu-nav-user` 从 nav 搬进弹层 | 从全 `document` 查找，并整体搬用原节点而非克隆 |
| 顶栏原本没有头像图片 | 取 `UserContext.avatarUrl`（页面里是 JSON 字符串，已做 parse 兜底），取不到降级为首字母圆标 |
| 消息条目上的未读角标会污染文案 | 文案清理后用作 `title`，纯数字角标另取生成红点 |
| Hydro 的 pjax 只替换 `data-fragment-id` 片段 | 导航壳不是片段，整页加载时重排一次即可，不会被 pjax 破坏 |
| 原导航的 `nav--active`、退出登录代理 | 保留 `nav--active` 与 `[name="nav_logout"]` 的 document 委托，行为不变 |

**适用范围**：默认主题 ui-default。换了主题或魔改过模板，需要按实际 DOM 调选择器。

## 定制

主题色只改 `frontend/luogu-ui.css` 顶部 `:root` 的 `--lgui-primary` 一处（默认 `#3498DB`，洛谷新前端 `--lfe-color--primary` 默认值）。侧栏宽度、顶栏高度、暗色主题变量也都在同一处。

## 关于 preview/luogu-ui-demo.html

**这是本地预览用的壳文件，不在插件运行路径里，装到服务器上不存在。** 里面的「题目列表 / 最近评测」是假数据，导航标记按 ui-default `templates/partials/nav.html` 真实结构仿制，只为在浏览器里直接看布局效果。它**不代表插件修改了任何页面内容**。直接在本地浏览器打开即可；URL 加 `#open` 可自动展开右侧抽屉。

## 许可证

AGPL-3.0（与 Hydro 一致）。
