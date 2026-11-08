// hydrooj-plugin-luogu-ui
// 洛谷式布局插件：左侧功能栏（默认只显图标，悬浮展开）+ 顶栏（含消息按钮）
//                + 右上角头像（点击后用户菜单从右侧滑出，替代原悬浮下拉）。
//
// 实现方式（严格参照 Hydro 官方插件文档"使用 TypeScript 编写插件" Step6 frontend 章节）：
//   frontend/luogu-ui.page.ts  前端入口，构建器自动打包进 entry.js（每页加载）
//   frontend/luogu-ui.css      布局样式，import 后自动注入 <head>
//   frontend/luogu-ui.js       DOM 重排核心（AutoloadPage 在每页 DOM 就绪后调用）
// 不注册任何后端路由、不读写数据库、不覆盖任何主题模板，仅做前端布局改造。
// 所有菜单条目均搬用 Hydro 自身渲染的原节点，不重写、不克隆页面内容。
// 前端文件改动后 Hydro 会自动重建 entry.js，刷新页面即生效（开发模式）。
//
// 安装（生产模式）：
//   1. 把本文件夹放到服务器，例如 /root/hydrooj-plugin-luogu-ui
//   2. hydrooj addon add /root/hydrooj-plugin-luogu-ui
//   3. 重启 Hydro：pm2 restart hydrooj
//      （若 entry.js 未自动生成，进 /root/Hydro 执行一次 yarn build:ui:production）
// 卸载：
//   hydrooj addon remove hydrooj-plugin-luogu-ui && pm2 restart hydrooj

export async function apply(ctx) {
    // 纯前端插件，无后端逻辑。
    // 保留 apply 入口以符合官方插件规范，并留出扩展点。
}
