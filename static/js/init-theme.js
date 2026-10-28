/*
 * @file This script initializes the theme data. This script should not be
 * deferred and should be placed within the <head> section of the page to
 * set the theme class on the DOM before rendering the page to prevent
 * flickering.
 *
 * Priority: explicit user choice in localStorage ("light"/"dark", written by
 * toggle-theme.js) > OS preference (prefers-color-scheme) > dark.
 *
 * NOTE: When this script runs inside <head>, `document.body` does not yet
 * exist. We therefore only mutate `document.documentElement` here. The icon
 * sync happens later in toggle-theme.js on DOMContentLoaded.
 */

(function () {
  let theme;
  try {
    const stored = localStorage.getItem("theme-storage");
    if (stored === "light" || stored === "dark") {
      theme = stored;
    }
  } catch (e) {
    // localStorage may be unavailable (private mode); fall through.
  }

  if (!theme) {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  document.documentElement.classList.add(theme);
})();
