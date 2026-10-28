/**
 * @file 站内搜索的界面部分：输入框、结果下拉框、快捷键。
 * 匹配与渲染逻辑在 search-core.js（window.SearchCore）。
 * 索引为 Zola fuse_json 格式，按当前语言加载，URL 写在输入框的 data-index 上。
 * Adapted from Zola repository: https://github.com/getzola/zola/blob/master/docs/static/search.js
 */

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to wait before calling the
 * function.
 * @return {Function} - A new function that, when called, will delay the
 * execution of `func` until after `wait` milliseconds have passed since the
 * last time it was invoked.
 */
function debounce(func, wait) {
  var timeout;

  return function () {
    var context = this;
    var args = arguments;
    clearTimeout(timeout);

    timeout = setTimeout(function () {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Initializes the search functionality by setting up event listeners
 * and loading the search index.
 */
function initSearch() {
  var $searchInput = document.getElementById("search");
  if (!$searchInput) {
    return;
  }
  var $searchResults = document.querySelector(".search-results");
  var $searchResultsItems = document.querySelector(".search-results__items");
  var $searchBox = document.querySelector(".search-box");
  var $searchIcon = $searchBox ? $searchBox.querySelector(".search-icon") : null;
  var mobileQuery = window.matchMedia("(max-width: 60em)");
  var MAX_ITEMS = 10;

  // On narrow screens the search box is collapsed into an icon. Tapping the
  // icon expands it to fill the nav bar; tapping outside collapses it again.
  // Position the results panel as a viewport-fixed dropdown anchored under the
  // search box. Using `fixed` lets it escape the nav bar's `overflow` clipping
  // and paint above the page content regardless of layout.
  function positionResults() {
    if (!$searchBox || !$searchResults) {
      return;
    }
    // On mobile, anchor to the visible input (which is inset from the bar
    // edges) so the dropdown lines up with it instead of spanning full width.
    var anchor = mobileQuery.matches ? $searchInput : $searchBox;
    var rect = anchor.getBoundingClientRect();
    $searchResults.style.position = "fixed";
    $searchResults.style.top = rect.bottom + 4 + "px";
    $searchResults.style.left = rect.left + "px";
    $searchResults.style.right = "auto";
    if (mobileQuery.matches) {
      $searchResults.style.width = rect.width + "px";
    } else {
      $searchResults.style.width = "";
    }
  }

  function showResults() {
    if (!$searchResults) {
      return;
    }
    $searchResults.style.display = "block";
    positionResults();
  }

  function hideResults() {
    if ($searchResults) {
      $searchResults.style.display = "none";
    }
  }

  function collapseSearch() {
    if ($searchBox) {
      $searchBox.classList.remove("search-expanded");
    }
    hideResults();
  }

  // Keep the dropdown anchored if the viewport scrolls or resizes.
  window.addEventListener("scroll", function () {
    if ($searchResults && $searchResults.style.display === "block") {
      positionResults();
    }
  });
  window.addEventListener("resize", function () {
    if ($searchResults && $searchResults.style.display === "block") {
      positionResults();
    }
  });

  if ($searchBox && $searchIcon) {
    $searchIcon.addEventListener("click", function (e) {
      if (!mobileQuery.matches) {
        return;
      }
      e.stopPropagation();
      if ($searchBox.classList.contains("search-expanded")) {
        collapseSearch();
      } else {
        $searchBox.classList.add("search-expanded");
        $searchInput.focus();
      }
    });

    // Tap outside the expanded search box collapses it back to an icon.
    document.addEventListener("click", function (e) {
      if (
        mobileQuery.matches &&
        $searchBox.classList.contains("search-expanded") &&
        !$searchBox.contains(e.target)
      ) {
        collapseSearch();
      }
    });

    // Drop the expanded state when returning to a wide layout.
    mobileQuery.addEventListener("change", function (e) {
      if (!e.matches) {
        $searchBox.classList.remove("search-expanded");
      }
    });
  }

  var currentTerm = "";
  var index;

  // 只加载一次；失败时缓存 null，后续查询直接提示索引不可用
  function initIndex() {
    if (index === undefined) {
      index = fetch($searchInput.dataset.index)
        .then(function (response) {
          if (!response.ok) {
            console.warn("Search index not found:", $searchInput.dataset.index);
            return null;
          }
          return response.json();
        })
        .catch(function (error) {
          console.error("Error loading search index:", error);
          return null;
        });
    }
    return index;
  }

  function showMessage(text) {
    showResults();
    $searchResultsItems.innerHTML =
      '<li class="search-results__item search-results__no-results">' +
      SearchCore.escapeHtml(text) +
      "</li>";
  }

  $searchInput.addEventListener(
    "keyup",
    debounce(async function () {
      var term = $searchInput.value.trim();
      if (term === currentTerm) {
        return;
      }
      if (term === "") {
        hideResults();
      } else {
        showResults();
      }
      $searchResultsItems.innerHTML = "";
      currentTerm = term;
      if (term === "") {
        return;
      }

      var docs = await initIndex();
      // 等待索引期间输入可能已经变了，只渲染最新一次查询
      if (term !== currentTerm) {
        return;
      }
      if (!docs) {
        showMessage($searchInput.dataset.unavailable);
        return;
      }

      var results = SearchCore.searchDocs(docs, term, MAX_ITEMS);
      if (results.length === 0) {
        showMessage($searchInput.dataset.noResults);
        return;
      }

      var terms = SearchCore.parseTerms(term);
      results.forEach(function (result) {
        var item = document.createElement("li");
        item.innerHTML = SearchCore.formatResult(result, terms);
        $searchResultsItems.appendChild(item);
      });
    }, 150),
  );

  // exit search on ESC key and move cursor out of search results
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      // clear search query to go back to placeholder
      $searchInput.value = "";
      $searchInput.blur();
      collapseSearch();
    }
  });

  // event listener for `/` to move cursor to search input
  document.addEventListener("keydown", function (e) {
    if (e.key === "/") {
      // don't have input be `/`
      e.preventDefault();
      $searchInput.focus();
    }
  });

  // on enter event immediately display results
  $searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      showResults();
    }
  });

  window.addEventListener("click", function (e) {
    if (
      $searchResults.style.display === "block" &&
      !$searchResults.contains(e.target) &&
      !(($searchBox && $searchBox.contains(e.target)))
    ) {
      hideResults();
    }
  });
}

// Check if the document is already loaded or not
if (
  document.readyState === "complete" ||
  (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  initSearch();
} else {
  document.addEventListener("DOMContentLoaded", initSearch);
}
