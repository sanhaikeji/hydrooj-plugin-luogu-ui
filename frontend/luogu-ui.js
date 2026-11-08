/* ============================================================
   hydrooj-plugin-luogu-ui - 洛谷式布局（浏览器端核心逻辑）
   纯 DOM 重排，不触碰任何 Hydro 数据：

   原布局（partials/nav.html）：顶部一条 nav#menu，主功能横排，
   用户菜单靠 data-dropdown-*（tether-drop 悬浮）弹出。

   新布局（洛谷式）：
     1. 左侧固定功能栏：默认 64px 只显图标（不显文字），
        鼠标悬浮平滑展开 240px 显示文字；点选条目时每个图标播放【专属像素级动效】
     2. 顶部固定栏：页面标题 + 域/语言切换 + 消息按钮 + 右上角头像
        消息按钮 = 把用户菜单里的"消息"一条搬到顶栏（链接仍是 Hydro 原节点，
        抽屉里不再保留重复条目），点击播放信封专属动效后跳转
     3. 头像【点击】→ 用户菜单从屏幕右侧滑出（抽屉式，右→左展开），
        菜单直接搬用 Hydro 原节点 #menu-nav-user，不重写、不克隆条目

   入口：frontend/luogu-ui.page.ts 通过 AutoloadPage 在每页调用
   window.LGUI.mount()。任何异常都会加 html.lgui-failed 自动回退默认布局。
   ============================================================ */
(function () {
    'use strict';

    var MOBILE_MAX = 1000;

    /* ---------- 图标（Feather 风格内联 SVG） ---------- */
    var ICONS = {
        home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
        problem: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7"/><path d="M9 16h7"/>',
        training: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
        homework: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6v3H9z"/><path d="M9 11h6"/><path d="M9 15h6"/>',
        contest: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5v1.5A3.5 3.5 0 0 0 9 10"/><path d="M16 5h2.5v1.5A3.5 3.5 0 0 1 15 10"/><path d="M12 13v3.5"/><path d="M8.5 20.5h7"/><path d="M10 16.5h4v4h-4z"/>',
        record: '<path pathLength="1" d="M3 12h4l3-8 4 16 3-8h4"/>',
        discussion: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9h8"/><path d="M8 12.5h5"/>',
        ranking: '<path d="M5 20.5V10h4v10.5z"/><path d="M10 20.5V4h4v16.5z"/><path d="M15 20.5v-7h4v7z"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
        domain: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.5 3 14 0 18"/><path d="M12 3c-3 3.5-3 14 0 18"/>',
        manage: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2 16.7 7.3M7.3 16.7l-2.1 2.1"/>',
        more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
        message: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 12.5 20.5 6.5"/>',
        close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
        burger: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    };

    function svg(name) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.more) + '</svg>';
    }

    /* 按 URL 路径选图标。
       注意：传入的是 a 标签的原始 href 属性（不是 .href 解析值），
       兼容 url_prefix 前缀与新旧两套路由（/p 与 /problem、/discuss 与 /discussion）。 */
    /* 把 a 的原始 href 属性规整成路径（兼容 url_prefix 前缀与新旧两套路由） */
    function toPath(rawHref) {
        var path = String(rawHref || '');
        path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ''); // 去掉协议域名
        path = path.split('#')[0].split('?')[0].toLowerCase();
        try {
            var prefix = String(readCtx('UiContext').url_prefix || '').replace(/\/+$/, '');
            if (prefix && path.indexOf(prefix + '/') === 0) path = path.slice(prefix.length);
        } catch (e) {}
        return path;
    }

    function iconFor(rawHref) {
        var path = toPath(rawHref);        if (path === '' || path === '/') return 'home';
        if (/\/(p|problem)(\/|$)/.test(path)) return 'problem';
        if (/\/training(\/|$)/.test(path)) return 'training';
        if (/\/contest(\/|$)/.test(path)) return 'contest';
        if (/\/homework(\/|$)/.test(path)) return 'homework';
        if (/\/(record|status)(\/|$)/.test(path)) return 'record';
        if (/\/(discuss|discussion)(\/|$)/.test(path)) return 'discussion';
        if (/\/ranking(\/|$)/.test(path)) return 'ranking';
        if (/\/(user|home)(\/|$)/.test(path)) return 'user';
        if (/\/(domain|manage)(\/|$)/.test(path)) return 'manage';
        return 'more';
    }

    /* ---------- 工具 ---------- */
    function readCtx(name) {
        var v = window[name];
        if (typeof v === 'string') {
            try { return JSON.parse(v); } catch (e) { return {}; }
        }
        return v && typeof v === 'object' ? v : {};
    }

    function parseUser() {
        var u = readCtx('UserContext');
        if (!u || !u._id) u = readCtx('UserContextNew');
        return u || {};
    }

    function el(tag, className, html) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (html != null) node.innerHTML = html;
        return node;
    }

    function setLabel(node, text) {
        node.textContent = String(text == null ? '' : text).trim();
    }

    // 站名取自 <title> 最后一段（Hydro 标题格式：页面名 - 站名）
    function siteName() {
        var t = String(document.title || '').trim();
        var parts = t.split(/\s+[-|–—]\s+/);
        return (parts.length > 1 ? parts[parts.length - 1] : t).trim() || 'HydroOJ';
    }

    function siteInitial() {
        var n = siteName().replace(/^[\s\W]+/, '');
        return (n.charAt(0) || 'H').toUpperCase();
    }

    // 菜单一律【搬用 Hydro 原节点】（appendChild 即搬移）：
    // 保持与 Hydro 引用一致，条目由 Hydro 渲染，本插件不重写内容。
    // 原触发 li 在 nav#menu 里、被本插件整体隐藏（display:none），
    // tether-drop 的悬浮弹出不会再触发，搬走的原节点不会被抢回去。

    /* ---------- 消息入口（从用户菜单抽取，搬到顶栏） ---------- */

    // 在用户菜单里找"消息"那一条：优先按 href 判定（/home/messages、/home/message），
    // 兜底按文案匹配（多语言部署下文案可能是 Messages / 消息 / 私信 等）。
    // 找不到就返回 null —— 顶栏不出消息按钮，菜单保持原样，绝不硬塞错条目。
    function findMessageItem(menu) {
        if (!menu) return null;
        var links = menu.querySelectorAll('li.menu__item > a.menu__link');
        var byHref = null;
        var byText = null;
        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var path = toPath(a.getAttribute('href') || '');
            if (!path) continue;
            if (!byHref && /\/home\/(messages?|msg|private_message)(\/|$)/.test(path)) byHref = a;
            if (!byText && /^[\s@#]*(messages?|inbox|私信|消息|站内消息|我的消息)$/i.test(cleanText(a))) byText = a;
        }
        return byHref || byText;
    }

    // 未读角标：Hydro 把未读数渲染在消息条目的角标元素里（class 含 number/badge/count）。
    // 取到就返回一个同数字的角标节点，取不到返回 null（不显示红点）。
    function unreadBadge(msgLink) {
        if (!msgLink) return null;
        var scope = [msgLink, msgLink.parentNode];
        for (var i = 0; i < scope.length; i++) {
            var node = scope[i];
            if (!node || !node.querySelector) continue;
            var cands = node.querySelectorAll('.icon-right-number, .badge, .badge--round, .menu__badge, [data-badge]');
            for (var k = 0; k < cands.length; k++) {
                var raw = String(cands[k].textContent || '').trim();
                if (!/^\d+$/.test(raw)) continue;
                if (raw === '0') continue;
                var badge = el('span', 'lgui-badge');
                setLabel(badge, raw);
                return badge;
            }
        }
        return null;
    }

    // 取链接纯文案：去掉其中的角标/图标子节点后剩下的文字（"消息 3" → "消息"）
    function cleanText(link) {
        if (!link) return '';
        var clone = link.cloneNode(true);
        var junk = clone.querySelectorAll('.icon-right-number, .badge, .badge--round, .menu__badge, .icon, [data-badge]');
        for (var i = 0; i < junk.length; i++) {
            if (junk[i].parentNode) junk[i].parentNode.removeChild(junk[i]);
        }
        return String(clone.textContent || '').replace(/\s+/g, ' ').trim() || '消息';
    }

    // 把消息那一条 li 从菜单移除；顺带清掉因此变成相邻/首尾多余的分隔线，避免抽屉里出现两条杠
    function removeMenuItem(link) {
        var li = link.closest ? link.closest('li') : null;
        if (!li || !li.parentNode) {
            if (link.parentNode) link.parentNode.removeChild(link);
            return;
        }
        var parent = li.parentNode;
        var prev = li.previousElementSibling;
        var next = li.nextElementSibling;
        parent.removeChild(li);
        var isSep = function (n) { return n && n.classList && n.classList.contains('menu__seperator'); };
        if (isSep(prev) && (isSep(next) || !next)) parent.removeChild(prev);
        else if (!prev && isSep(next)) parent.removeChild(next);
    }

    /* ---------- 下拉（点击开关，替代原悬浮） ---------- */
    var popovers = [];

    function closeAllPopovers(except) {
        for (var i = 0; i < popovers.length; i++) {
            var p = popovers[i];
            if (p.pop !== except) {
                p.pop.classList.remove('open');
                p.btn.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function bindPopover(btn, pop) {
        popovers.push({ btn: btn, pop: pop });
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var willOpen = !pop.classList.contains('open');
            closeAllPopovers(pop);
            pop.classList.toggle('open', willOpen);
            btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        pop.addEventListener('click', function (ev) { ev.stopPropagation(); });
    }

    document.addEventListener('click', function () { closeAllPopovers(null); });
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' || ev.keyCode === 27) {
            closeAllPopovers(null);
            closeDrawer();
            document.documentElement.classList.remove('lgui-nav-open');
        }
    });

    /* ---------- 用户抽屉（从屏幕右侧滑入，右→左展开，替代悬浮下拉） ---------- */
    var drawer = null;
    var drawerOverlay = null;

    function openDrawer() {
        closeAllPopovers(null);
        document.documentElement.classList.add('lgui-drawer-open');
        if (drawer) drawer.setAttribute('aria-hidden', 'false');
        var av = document.getElementById('lgui-avatar');
        if (av) av.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
        document.documentElement.classList.remove('lgui-drawer-open');
        if (drawer) drawer.setAttribute('aria-hidden', 'true');
        var av = document.getElementById('lgui-avatar');
        if (av) av.setAttribute('aria-expanded', 'false');
    }

    function toggleDrawer() {
        if (document.documentElement.classList.contains('lgui-drawer-open')) closeDrawer();
        else openDrawer();
    }

    function letterAvatar(btn, user, fallbackText) {
        var name = (user && (user.displayName || user.uname)) || fallbackText || '?';
        btn.textContent = String(name).trim().charAt(0).toUpperCase();
    }

    /* ---------- 主流程 ---------- */
    function build() {
        if (document.getElementById('lgui-sidebar')) return;
        var nav = document.querySelector('nav#menu');
        var mainList = nav && nav.querySelector('ol.nav__list--main');
        if (!nav || !mainList) return; // 无导航的页面（登录/注册等），保持原样

        var user = parseUser();

        /* ---- 左侧功能栏 ---- */
        var sidebar = el('aside');
        sidebar.id = 'lgui-sidebar';

        var logoBox = el('div', 'lgui-logo');
        var logoLink = el('a');
        logoLink.href = '/';
        var logoImg = mainList.querySelector('img.nav__logo');
        if (logoImg) {
            var img = document.createElement('img');
            img.src = logoImg.src;
            img.alt = '';
            logoLink.appendChild(img);
        }
        // 收起态显示字母圆标：宽幅 wordmark 压到 64px 只剩一团糊影
        var mark = el('span', 'lgui-logo-mark');
        setLabel(mark, siteInitial());
        logoLink.appendChild(mark);
        if (!logoImg) {
            var logoText = el('span', 'lgui-logo-text');
            setLabel(logoText, siteName());
            logoLink.appendChild(logoText);
        }
        logoBox.appendChild(logoLink);
        sidebar.appendChild(logoBox);

        var list = el('ul', 'lgui-nav');
        var items = mainList.querySelectorAll('li.nav__list-item');
        for (var i = 0; i < items.length; i++) {
            var a = items[i].querySelector('a.nav__item');
            if (!a || a.querySelector('img.nav__logo')) continue; // 跳过 logo 项
            var li = document.createElement('li');
            var link = document.createElement('a');
            link.href = a.href;
            if (a.classList.contains('nav--active')) link.className = 'lgui-active';
            link.title = a.textContent.trim();
            // 图标 span 带 lgui-ico--<图标名> 专属类，CSS 据此播放像素级动效
            var icon = iconFor(a.getAttribute('href') || a.href);
            link.appendChild(el('span', 'lgui-ico lgui-ico--' + icon, svg(icon)));
            var lab = el('span', 'lgui-label');
            setLabel(lab, a.textContent);
            link.appendChild(lab);
            li.appendChild(link);
            list.appendChild(li);
        }
        sidebar.appendChild(list);

        /* ---- 顶栏 ---- */
        var topbar = el('header');
        topbar.id = 'lgui-topbar';

        var burger = el('button', 'lgui-burger');
        burger.type = 'button';
        burger.setAttribute('aria-label', '菜单');
        burger.innerHTML = svg('burger');
        topbar.appendChild(burger);

        var title = el('div', 'lgui-title');
        setLabel(title, document.title);
        topbar.appendChild(title);

        var actions = el('div', 'lgui-actions');

        var secondary = nav.querySelector('ol.nav__list--secondary');
        var secItems = secondary ? secondary.querySelectorAll('li.nav__list-item') : [];
        var userMenu = null;
        var userTriggerText = '';

        for (var j = 0; j < secItems.length; j++) {
            var sli = secItems[j];
            var targetSel = sli.getAttribute('data-dropdown-target');
            // 菜单可能已被 tether-drop 挪出 nav（包进 div.drop 弹层），所以从全 document 找
            var menu = targetSel ? document.querySelector(targetSel) : null;
            var triggerA = sli.querySelector('a');

            // 登录用户的下拉（#menu-nav-user 且触发链接指向用户主页）→ 头像
            if (targetSel && menu && menu.id === 'menu-nav-user'
                && triggerA && /\/user\//.test(triggerA.getAttribute('href') || '')) {
                userMenu = menu;
                userTriggerText = triggerA.textContent.trim();
                continue;
            }
            // 登录 / 注册
            if (triggerA && triggerA.getAttribute('name') === 'nav_login') {
                var loginLink = el('a', 'lgui-link');
                loginLink.href = triggerA.href;
                setLabel(loginLink, triggerA.textContent);
                actions.appendChild(loginLink);
                continue;
            }
            if (triggerA && triggerA.classList.contains('nav__item--round')) {
                var regLink = el('a', 'lgui-link lgui-link--primary');
                regLink.href = triggerA.href;
                setLabel(regLink, triggerA.textContent);
                actions.appendChild(regLink);
                continue;
            }
            // 其余悬浮下拉（语言、域切换）→ chip + 点击下拉
            if (targetSel && menu) {
                var chip = el('div', 'lgui-chip');
                var chipBtn = el('button', 'lgui-chip-btn');
                chipBtn.type = 'button';
                var triggerImg = triggerA && triggerA.querySelector('img');
                if (triggerImg) {
                    var chipImg = document.createElement('img');
                    chipImg.src = triggerImg.src;
                    chipImg.alt = '';
                    chipBtn.appendChild(chipImg);
                }
                var chipText = el('span');
                setLabel(chipText, triggerA ? triggerA.textContent : menu.id);
                chipBtn.appendChild(chipText);
                var chipPop = el('div', 'lgui-popover');
                chipPop.appendChild(menu); // 搬用 Hydro 原菜单节点
                chip.appendChild(chipBtn);
                chip.appendChild(chipPop);
                actions.appendChild(chip);
                bindPopover(chipBtn, chipPop);
            }
        }

        // 头像按钮 + 右侧滑出抽屉（菜单搬用 Hydro 原节点 #menu-nav-user）
        if (userMenu) {
            // ---- 消息入口搬到顶栏：取用户菜单里的"消息"一条，整条 li 移出菜单，不留重复 ----
            var msgLink = findMessageItem(userMenu);
            if (msgLink) {
                var msgBtn = el('a', 'lgui-msg');
                msgBtn.href = msgLink.href;                  // 沿用 Hydro 原链接
                msgBtn.title = cleanText(msgLink);           // 沿用 Hydro 原文案（去掉角标数字）
                msgBtn.setAttribute('aria-label', msgBtn.title);
                msgBtn.appendChild(el('span', 'lgui-ico lgui-ico--message', svg('message')));
                var badge = unreadBadge(msgLink);
                if (badge) msgBtn.appendChild(badge);
                actions.appendChild(msgBtn);

                // 点击：信封动效播一拍再跳转（与左栏条目同一套节奏）
                msgBtn.addEventListener('click', function (ev) {
                    var ico = msgBtn.querySelector('.lgui-ico');
                    if (ico) {
                        ico.classList.remove('lgui-ico-pop');
                        void ico.offsetWidth;
                        ico.classList.add('lgui-ico-pop');
                    }
                    if (ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey
                        && !ev.defaultPrevented && msgBtn.target !== '_blank') {
                        ev.preventDefault();
                        var href = msgBtn.href;
                        closeDrawer();
                        setTimeout(function () { window.location.href = href; }, 350);
                    }
                });

                removeMenuItem(msgLink);
            }

            var btn = el('button');
            btn.id = 'lgui-avatar';
            btn.type = 'button';
            btn.title = userTriggerText || '用户菜单';
            btn.setAttribute('aria-label', btn.title);
            btn.setAttribute('aria-expanded', 'false');
            var avatarUrl = user && user.avatarUrl;
            if (avatarUrl) {
                var av = document.createElement('img');
                av.src = avatarUrl;
                av.alt = '';
                av.addEventListener('error', function () {
                    if (av.parentNode) av.parentNode.removeChild(av);
                    letterAvatar(btn, user, userTriggerText);
                });
                btn.appendChild(av);
            } else {
                letterAvatar(btn, user, userTriggerText);
            }
            actions.appendChild(btn);

            drawer = el('aside');
            drawer.id = 'lgui-user-drawer';
            drawer.setAttribute('aria-hidden', 'true');

            var dhead = el('div', 'lgui-drawer-head');
            var dAv = el('div', 'lgui-drawer-avatar');
            if (avatarUrl) {
                var dav = document.createElement('img');
                dav.src = avatarUrl;
                dav.alt = '';
                dAv.appendChild(dav);
            } else {
                letterAvatar(dAv, user, userTriggerText);
            }
            var dId = el('div', 'lgui-drawer-id');
            var dName = el('div', 'lgui-drawer-name');
            setLabel(dName, (user && (user.displayName || user.uname)) || userTriggerText || '');
            var dSub = el('div', 'lgui-drawer-sub');
            setLabel(dSub, (user && user.uname) || '');
            dId.appendChild(dName);
            dId.appendChild(dSub);
            var dClose = el('button', 'lgui-drawer-close');
            dClose.type = 'button';
            dClose.setAttribute('aria-label', '关闭');
            dClose.innerHTML = svg('close');
            dhead.appendChild(dAv);
            dhead.appendChild(dId);
            dhead.appendChild(dClose);

            var dbody = el('div', 'lgui-drawer-body');
            dbody.appendChild(userMenu); // 搬用 Hydro 原菜单节点，条目原样

            drawer.appendChild(dhead);
            drawer.appendChild(dbody);

            drawerOverlay = el('div');
            drawerOverlay.id = 'lgui-drawer-overlay';

            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                toggleDrawer();
            });
            dClose.addEventListener('click', function (ev) {
                ev.stopPropagation();
                closeDrawer();
            });
            drawerOverlay.addEventListener('click', closeDrawer);
        }

        topbar.appendChild(actions);

        /* ---- 装配 ---- */
        var overlay = el('div');
        overlay.id = 'lgui-overlay';

        var first = document.body.firstChild;
        document.body.insertBefore(overlay, first);
        document.body.insertBefore(topbar, first);
        document.body.insertBefore(sidebar, first);
        if (drawer) {
            document.body.appendChild(drawerOverlay);
            document.body.appendChild(drawer);
        }
        document.documentElement.classList.add('lgui-on');

        /* ---- 交互 ---- */
        burger.addEventListener('click', function (ev) {
            ev.stopPropagation();
            document.documentElement.classList.toggle('lgui-nav-open');
        });
        overlay.addEventListener('click', function () {
            document.documentElement.classList.remove('lgui-nav-open');
        });
        list.addEventListener('click', function (ev) {
            if (window.innerWidth <= MOBILE_MAX) document.documentElement.classList.remove('lgui-nav-open');
            var link = ev.target && ev.target.closest ? ev.target.closest('a') : null;
            if (!link || link.getAttribute('href') == null) return;
            // 选中条目：左侧图标播专属像素级动效（图标整体 + 子形状分别动）+ 染主色
            var ico = link.querySelector('.lgui-ico');
            if (ico) {
                ico.classList.remove('lgui-ico-pop');
                void ico.offsetWidth; // 强制重排，连点同一项也能重放动画
                ico.classList.add('lgui-ico-pop');
            }
            // 左键普通点击：让动效播一拍再跳转（专属动效 0.55~0.8s，取中前段 350ms）。
            // 若已被别的脚本 preventDefault（如演示页拦截导航），则只播动效不跳转。
            if (ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey
                && !ev.defaultPrevented && link.target !== '_blank') {
                ev.preventDefault();
                var href = link.href;
                setTimeout(function () { window.location.href = href; }, 350);
            }
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth > MOBILE_MAX) document.documentElement.classList.remove('lgui-nav-open');
        });

        // 当前页对应的条目：进入页面时图标播一次动效，作为"已选中"反馈
        var activeIco = list.querySelector('.lgui-active .lgui-ico');
        if (activeIco) activeIco.classList.add('lgui-ico-pop');
    }

    function mount() {
        try {
            build();
        } catch (e) {
            // 任何异常都回退默认布局，绝不把站点搞挂
            document.documentElement.classList.add('lgui-failed');
            if (window.console && console.warn) console.warn('[luogu-ui] 初始化失败，已回退默认布局：', e);
        }
    }

    window.LGUI = { mount: mount };
})();
