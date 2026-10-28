/**
 * @file 站内搜索的匹配与渲染纯函数，不依赖 DOM。
 * 浏览器中挂到 window.SearchCore，Node 测试中通过 module.exports 引入。
 * 索引为 Zola fuse_json 格式：[{url, title, body}]。transparent section 会让
 * 同一页面出现多次，因此结果按 url 去重。中文没有空格分词，所以用子串匹配。
 * 正文里的 HTML 实体先解码再匹配；输出时统一转义一次（标题本来就是原文）。
 */
(function (root) {
  "use strict";

  var HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return HTML_ESCAPES[c];
    });
  }

  var NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

  /** fuse_json 的正文保留了 HTML 实体，匹配和转义前先还原成字符。 */
  function decodeEntities(text) {
    return String(text).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (m, code) {
      if (code[0] === "#") {
        var n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return isNaN(n) || n > 0x10ffff ? m : String.fromCodePoint(n);
      }
      var named = NAMED_ENTITIES[code.toLowerCase()];
      return named === undefined ? m : named;
    });
  }

  /** 小写后按空白切分，去掉空串。 */
  function parseTerms(term) {
    return String(term)
      .toLowerCase()
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 0;
      });
  }

  /**
   * 所有关键词都要在标题或正文中出现（AND）。每个关键词标题命中计 2 分、
   * 正文命中计 1 分；同分按索引顺序。
   */
  function searchDocs(docs, term, limit) {
    var terms = parseTerms(term);
    if (terms.length === 0) {
      return [];
    }
    var seen = {};
    var results = [];
    (docs || []).forEach(function (doc, order) {
      if (!doc || !doc.url || seen[doc.url]) {
        return;
      }
      var rawBody = decodeEntities(doc.body || "");
      var title = (doc.title || "").toLowerCase();
      var body = rawBody.toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var inTitle = title.indexOf(terms[i]) !== -1;
        var inBody = body.indexOf(terms[i]) !== -1;
        if (!inTitle && !inBody) {
          return;
        }
        score += (inTitle ? 2 : 0) + (inBody ? 1 : 0);
      }
      seen[doc.url] = true;
      results.push({
        url: doc.url,
        title: doc.title || doc.url,
        body: rawBody,
        score: score,
        order: order,
      });
    });
    results.sort(function (a, b) {
      return b.score - a.score || a.order - b.order;
    });
    return typeof limit === "number" ? results.slice(0, limit) : results;
  }

  /** 转义片段，并把关键词（取最长匹配）包进 <b>。 */
  function highlight(snippet, terms) {
    var lower = snippet.toLowerCase();
    var out = "";
    var i = 0;
    while (i < snippet.length) {
      var hit = "";
      for (var k = 0; k < terms.length; k++) {
        if (terms[k] && lower.startsWith(terms[k], i) && terms[k].length > hit.length) {
          hit = terms[k];
        }
      }
      if (hit) {
        out += "<b>" + escapeHtml(snippet.substr(i, hit.length)) + "</b>";
        i += hit.length;
      } else {
        out += escapeHtml(snippet[i]);
        i += 1;
      }
    }
    return out;
  }

  /** 以第一个命中的关键词为中心截取约 2 × radius 个字符；没有命中时取开头。 */
  function makeTeaser(body, terms, radius) {
    radius = radius || 60;
    var text = String(body || "");
    var lower = text.toLowerCase();
    var first = -1;
    terms.forEach(function (t) {
      var pos = lower.indexOf(t);
      if (pos !== -1 && (first === -1 || pos < first)) {
        first = pos;
      }
    });
    var start = first === -1 ? 0 : Math.max(0, first - radius);
    var end = Math.min(text.length, Math.max(first, 0) + radius * 2);
    return (
      (start > 0 ? "…" : "") +
      highlight(text.slice(start, end), terms) +
      (end < text.length ? "…" : "")
    );
  }

  function formatResult(result, terms) {
    return (
      '<article class="search-results__item">' +
      '<a href="' + escapeHtml(result.url) + '">' + escapeHtml(result.title) + "</a>" +
      "<section>" + makeTeaser(result.body, terms) + "</section>" +
      "</article>"
    );
  }

  var api = {
    escapeHtml: escapeHtml,
    decodeEntities: decodeEntities,
    parseTerms: parseTerms,
    searchDocs: searchDocs,
    makeTeaser: makeTeaser,
    formatResult: formatResult,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SearchCore = api;
  }
})(typeof window !== "undefined" ? window : this);
