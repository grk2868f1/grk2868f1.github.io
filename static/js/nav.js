/**
 * @file Mobile navigation toggle. On narrow screens the menu links collapse
 * into a hamburger button; tapping it opens/closes the dropdown.
 */
function initNav() {
  var navbar = document.querySelector(".nav-header .navbar");
  if (!navbar) {
    return;
  }
  var toggle = navbar.querySelector(".nav-toggle");
  var links = navbar.querySelector(".nav-links");
  if (!toggle || !links) {
    return;
  }

  function closeMenu() {
    navbar.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    navbar.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    if (navbar.classList.contains("nav-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close after picking a destination.
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      closeMenu();
    }
  });

  // Close when tapping outside the menu.
  document.addEventListener("click", function (e) {
    if (navbar.classList.contains("nav-open") && !navbar.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
    }
  });
}

if (
  document.readyState === "complete" ||
  (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  initNav();
} else {
  document.addEventListener("DOMContentLoaded", initNav);
}
