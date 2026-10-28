/*
 * @file Theme toggle button wiring.
 *
 * init-theme.js (loaded synchronously in <head>) already applies the correct
 * `.light` / `.dark` class to <html> before first paint. All themed CSS
 * selectors target `<html>` only (see sass/_theme.scss for the note), so this
 * script intentionally does NOT re-apply the theme class on DOMContentLoaded —
 * doing so would cause a redundant style recalculation that's visible on
 * list-heavy pages (categories / tags / posts index) as a brief flicker.
 *
 * Adapted from `apollo` theme:
 * @see https://github.com/not-matthias/apollo/blob/main/static/js/themetoggle.js
 */

document.addEventListener("DOMContentLoaded", function () {
  const currentTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  updateThemeIcons(currentTheme);

  const toggleButton = document.getElementById("dark-mode-toggle");
  if (toggleButton) {
    toggleButton.addEventListener("click", function (event) {
      event.preventDefault();
      toggleTheme();
    });
  }
});

/**
 * Updates the theme mode in local storage and applies it to <html>.
 * @param {string} mode - "light" or "dark".
 */
function setTheme(mode) {
  localStorage.setItem("theme-storage", mode);
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(mode);
  updateThemeIcons(mode);
}

function toggleTheme() {
  const newTheme = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  setTheme(newTheme);
}

function updateThemeIcons(mode) {
  const sunIcon = document.getElementById("sun-icon");
  const moonIcon = document.getElementById("moon-icon");

  if (sunIcon && moonIcon) {
    sunIcon.style.display = mode === "dark" ? "inline-block" : "none";
    moonIcon.style.display = mode === "light" ? "inline-block" : "none";
  }
}
