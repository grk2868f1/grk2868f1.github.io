/**
 * @file reference-return.js Linking footnotes to their references
 * @author Micah Kepe
 */

document.addEventListener("DOMContentLoaded", function () {
  // Initial deep links can shift during math layout, or point at references
  // that do not exist until citations.js has fetched the bibliography.
  const initialHash = window.location.hash;
  function restoreInitialAnchor() {
    if (!initialHash || window.location.hash !== initialHash) return;
    let id;
    try { id = decodeURIComponent(initialHash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (target) target.scrollIntoView();
  }
  document.addEventListener("mathjax:ready", restoreInitialAnchor);
  document.addEventListener("references:ready", restoreInitialAnchor);

  const footnotes = document.querySelectorAll(".footnote-definition");
  footnotes.forEach((fn) => {
    const footnoteId = fn.id;
    const referrerLink = document.querySelector(`a[href="#${footnoteId}"]`);
    if (!referrerLink) return;

    // add ID to the referring anchor tag if needed
    let refId = referrerLink.id;
    if (!refId) {
      refId = `fnref-${footnoteId}`;
      referrerLink.id = refId;
    }

    const returnLink = document.createElement("a");
    returnLink.href = `#${refId}`;
    returnLink.classList = "footnote-return";
    returnLink.textContent = "↩";

    // ARIA
    returnLink.setAttribute("aria-label", "Return to footnote reference");
    returnLink.setAttribute("role", "link");
    returnLink.setAttribute("tabindex", "0");

    // Append to the last p tag
    const lastParagraph = fn.querySelector("p:last-of-type");
    if (lastParagraph) {
      lastParagraph.appendChild(returnLink);
    } else {
      // If no paragraph, append to the footnote definition directly
      fn.appendChild(returnLink);
    }
  });
});
