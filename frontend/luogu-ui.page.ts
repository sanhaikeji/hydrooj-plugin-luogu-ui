// hydrooj-plugin-luogu-ui 前端入口。
// 文件名匹配 frontend/[a-zA-Z0-9_]+.page.[jt]sx? 规则，会被 Hydro 的 UI 构建器
// 自动打包进 entry.js；import 的 CSS 会自动注入页面 <head>（官方 frontend 机制）。
import './luogu-ui.css';
import './luogu-ui.js';
import { addPage, AutoloadPage } from '@hydrooj/ui-default';

declare global {
    interface Window {
        LGUI: { mount: () => void };
    }
}

// AutoloadPage：在每一页执行（DOM 就绪后），把默认顶栏重排为洛谷式布局。
addPage(new AutoloadPage('luogu_ui', () => {
    window.LGUI.mount();
}));
