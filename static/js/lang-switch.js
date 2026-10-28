/**
 * @file 语言下拉菜单（<details class="lang-switch">）的收起行为：
 * 原生 <details> 只能点按钮开合，这里补上点击菜单外部或按 Esc 时收起。
 */
(function () {
  "use strict";

  function init() {
    var menu = document.querySelector("details.lang-switch");
    if (!menu) {
      return;
    }

    document.addEventListener("click", function (e) {
      if (menu.open && !menu.contains(e.target)) {
        menu.open = false;
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary").focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
