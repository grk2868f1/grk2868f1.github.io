/**
 * @file citations.js — LaTeX 风格文献引用
 *
 * 模板在文章或摘要容器上设置 data-bib；摘要的 data-reference-url
 * 指向完整文章，引用编号分别从各篇文章的首次出现开始。
 *
 * 功能：
 *   1. 抓取并解析同目录下的 BibTeX 文件（与 LaTeX 所用格式完全一致）；
 *   2. 把正文中的 \cite{key} / \cite{k1,k2} 替换为 [1] 式可点击引用，
 *      编号按首次出现顺序分配（同 LaTeX 的 unsrt 风格）；
 *      \nocite{key} / \nocite{*} 只把文献计入列表、不产生行内标记；
 *   3. 在正文末尾生成 "References" 一节，条目按 MLA 格式排版，
 *      例如：Burke, Kieron, and Lucas O. Wagner. "DFT in a nutshell."
 *            International Journal of Quantum Chemistry 113.2 (2013): 96-101.
 *
 * 代码块（pre/code）和 MathJax 输出中的 \cite 不会被替换。
 */

(function () {
  "use strict";

  /* ====================================================================
   * BibTeX 解析
   * ================================================================== */

  /** 返回与 s[open]（必须是 "{"）配对的 "}" 的下标；未配对返回 -1 */
  function findClosingBrace(s, open) {
    var depth = 0;
    for (var i = open; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** 从 s[i] 起解析一个字段值：{分组}、"引号" 或裸词，支持 # 连接 */
  function parseValue(s, i) {
    var value = "";
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (i >= s.length) break;
      var c = s[i];
      var j;
      if (c === "{") {
        j = findClosingBrace(s, i);
        if (j < 0) return null;
        value += s.slice(i + 1, j);
        i = j + 1;
      } else if (c === '"') {
        // BibTeX 规定引号值内的花括号必须配对，按深度扫描找到闭合引号
        j = i + 1;
        var depth = 0;
        while (j < s.length && (s[j] !== '"' || depth > 0)) {
          if (s[j] === "{") depth++;
          else if (s[j] === "}") depth--;
          j++;
        }
        value += s.slice(i + 1, j);
        i = j + 1;
      } else {
        j = i;
        while (j < s.length && !/[,\s#]/.test(s[j])) j++;
        value += s.slice(i, j);
        i = j;
      }
      var k = i;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === "#") {
        i = k + 1;
        continue;
      }
      break;
    }
    return { value: value, next: i };
  }

  /** 解析 "@type{" 与 "}" 之间的内容 → {type, key, fields} */
  function parseEntryBody(type, body) {
    var comma = body.indexOf(",");
    if (comma < 0) return null;
    var key = body.slice(0, comma).trim();
    if (!key) return null;
    var fields = {};
    var i = comma + 1;
    while (i < body.length) {
      while (i < body.length && /[\s,]/.test(body[i])) i++;
      if (i >= body.length) break;
      var eq = body.indexOf("=", i);
      if (eq < 0) break;
      var name = body.slice(i, eq).trim().toLowerCase();
      var parsed = parseValue(body, eq + 1);
      if (!name || !parsed) break;
      fields[name] = parsed.value;
      i = parsed.next;
    }
    return { type: type, key: key, fields: fields };
  }

  /** 解析整个 .bib 文本 → 条目数组（保持文件顺序） */
  function parseBibtex(text) {
    var entries = [];
    var i = 0;
    for (;;) {
      var at = text.indexOf("@", i);
      if (at < 0) break;
      var m = /^@\s*([A-Za-z]+)\s*\{/.exec(text.slice(at));
      if (!m) {
        i = at + 1;
        continue;
      }
      var type = m[1].toLowerCase();
      var open = at + m[0].length - 1;
      var close = findClosingBrace(text, open);
      if (close < 0) break;
      i = close + 1;
      if (type === "comment" || type === "preamble" || type === "string") continue;
      var entry = parseEntryBody(type, text.slice(open + 1, close));
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /* ====================================================================
   * LaTeX 文本清理：重音、特殊字母、\textit{} 等 → 纯 Unicode 文本
   * ================================================================== */

  // LaTeX 重音命令 → Unicode 组合附加符（跟在字母后，NFC 归一化后合成单字符）
  var ACCENTS = {
    "'": "\u0301", "`": "\u0300", '"': "\u0308", "^": "\u0302",
    "~": "\u0303", "=": "\u0304", ".": "\u0307",
    u: "\u0306", v: "\u030C", H: "\u030B", r: "\u030A",
    c: "\u0327", k: "\u0328", b: "\u0331", d: "\u0323", t: "\u0361",
  };

  var SPECIAL_LETTERS = {
    o: "ø", O: "Ø", l: "ł", L: "Ł",
    i: "ı", j: "ȷ", ss: "ß",
    ae: "æ", AE: "Æ", oe: "œ", OE: "Œ",
    aa: "å", AA: "Å",
  };

  function cleanLatex(s) {
    if (!s) return "";
    s = String(s);
    // 重音：\'e、\'{e}、{\"o}、\v{s}、\c{c} … → 字母 + Unicode 组合符
    s = s.replace(/\\(['`"^~=.])\s*\{?([a-zA-Z])\}?/g, function (_, acc, ch) {
      return ch + ACCENTS[acc];
    });
    s = s.replace(/\\([uvHrckbdt])\s*\{([a-zA-Z])\}/g, function (_, acc, ch) {
      return ch + ACCENTS[acc];
    });
    // 特殊字母：\o \l \ss \ae …
    s = s.replace(/\\(ss|ae|AE|oe|OE|aa|AA|[oOlLij])(?![a-zA-Z])/g, function (_, w) {
      return SPECIAL_LETTERS[w];
    });
    // 文本命令保留内容：\textit{x} → {x}（花括号最后统一去掉）
    s = s.replace(/\\(?:textit|textbf|texttt|textsc|textrm|textnormal|text|emph|mathrm)\s*\{/g, "{");
    // 转义符号与空白命令
    s = s.replace(/\\([&%$#_])/g, "$1");
    s = s.replace(/~/g, " ");
    s = s.replace(/\\[,;\s]/g, " ");
    // 其余未识别命令直接去掉命令名
    s = s.replace(/\\[a-zA-Z]+\s*/g, "");
    // 去掉分组花括号，折叠空白
    s = s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    return s.normalize ? s.normalize("NFC") : s;
  }

  /* ====================================================================
   * 作者解析与 MLA 姓名格式
   * ================================================================== */

  var VON_PARTICLES = {
    von: 1, van: 1, der: 1, den: 1, de: 1, del: 1, della: 1,
    di: 1, da: 1, das: 1, dos: 1, du: 1, la: 1, le: 1, ter: 1, ten: 1,
  };

  /** "Burke, Kieron and Wagner, Lucas O." → [{first, last, suffix}, …] */
  function parseAuthors(s) {
    var authors = [];
    var etal = false;
    s.split(/\s+and\s+/).forEach(function (name) {
      name = name.trim();
      if (!name) return;
      if (name.toLowerCase() === "others") {
        etal = true;
        return;
      }
      var first = "", last = "", suffix = "";
      if (name.indexOf(",") >= 0) {
        // "von Last, First" 或 "von Last, Jr., First"
        var parts = name.split(",").map(function (t) { return t.trim(); });
        last = parts[0];
        first = parts[parts.length - 1];
        if (parts.length > 2) suffix = parts.slice(1, -1).join(", ");
      } else {
        // "First von Last"：von 部分从第一个小写词开始并入姓
        var words = name.split(/\s+/);
        var vi = -1;
        for (var w = 0; w < words.length - 1; w++) {
          if (VON_PARTICLES[words[w]]) {
            vi = w;
            break;
          }
        }
        if (vi >= 0) {
          first = words.slice(0, vi).join(" ");
          last = words.slice(vi).join(" ");
        } else {
          last = words[words.length - 1];
          first = words.slice(0, -1).join(" ");
        }
      }
      authors.push({ first: first, last: last, suffix: suffix });
    });
    return { authors: authors, etal: etal };
  }

  /**
   * MLA 姓名规则：
   *   1 人  → Burke, Kieron.
   *   2 人  → Burke, Kieron, and Lucas O. Wagner.
   *   3 人+ → Burke, Kieron, et al.
   */
  function formatAuthorsMLA(s) {
    var parsed = parseAuthors(s);
    var a = parsed.authors;
    if (!a.length) return "";
    var lead = a[0];
    var out = lead.last +
      (lead.first ? ", " + lead.first : "") +
      (lead.suffix ? ", " + lead.suffix : "");
    if (parsed.etal || a.length > 2) {
      out += ", et al.";
    } else if (a.length === 2) {
      var b = a[1];
      out += ", and " +
        (b.first ? b.first + " " : "") + b.last +
        (b.suffix ? ", " + b.suffix : "") + ".";
    } else {
      out += ".";
    }
    return out.replace(/\.\.$/, "."); // 名字缩写点结尾时避免双句点
  }

  /* ====================================================================
   * MLA 条目排版（返回 HTML 字符串，斜体用 <i>）
   * ================================================================== */

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** 标题 → "Title."（自带 ?! 结尾时不再加句点） */
  function quoteTitle(t) {
    if (!t) return ""; // 无标题的条目（如原书清单只给出刊名、卷、页）不输出空引号
    return '"' + escapeHtml(t) + (/[.!?]$/.test(t) ? "" : ".") + '" ';
  }

  /** 页码 96--101 / 96–101 → 96-101 */
  function formatPages(p) {
    return p.replace(/\s*[-–—]+\s*/g, "-");
  }

  function formatReference(entry) {
    var f = entry.fields;
    function get(name) {
      return cleanLatex(f[name] || "");
    }

    var authors = formatAuthorsMLA(get("author") || get("editor"));
    var title = get("title");
    var year = get("year");
    var pages = formatPages(get("pages"));
    var out = authors ? escapeHtml(authors) + " " : "";

    switch (entry.type) {
      case "article": {
        var journal = get("journal") || get("journaltitle");
        out += quoteTitle(title);
        if (journal) {
          // Google Scholar 常把 arXiv 预印本塞进 journal 字段，MLA 中不用斜体
          out += /^arxiv/i.test(journal) ? escapeHtml(journal) : "<i>" + escapeHtml(journal) + "</i>";
          var vol = get("volume");
          var num = get("number");
          if (vol) out += " " + escapeHtml(vol) + (num ? "." + escapeHtml(num) : "");
          else if (num) out += " " + escapeHtml(num);
          if (year) out += " (" + escapeHtml(year) + ")";
          out += pages ? ": " + escapeHtml(pages) + "." : ".";
        } else if (year) {
          out += "(" + escapeHtml(year) + ")" + (pages ? ": " + escapeHtml(pages) : "") + ".";
        }
        break;
      }
      case "book": {
        var publisher = get("publisher");
        var address = get("address");
        out += "<i>" + escapeHtml(title) + "</i>. ";
        if (publisher) {
          out += (address ? escapeHtml(address) + ": " : "") + escapeHtml(publisher) +
            (year ? ", " + escapeHtml(year) : "") + ".";
        } else if (year) {
          out += escapeHtml(year) + ".";
        }
        break;
      }
      case "inproceedings":
      case "incollection":
      case "inbook":
      case "conference": {
        var booktitle = get("booktitle");
        out += quoteTitle(title);
        if (booktitle) out += "<i>" + escapeHtml(booktitle) + "</i>. ";
        var pub = get("publisher") || get("organization");
        if (pub) out += escapeHtml(pub) + (year ? ", " + escapeHtml(year) : "") + ". ";
        else if (year) out += escapeHtml(year) + ". ";
        if (pages) out += escapeHtml(pages) + ".";
        break;
      }
      case "phdthesis":
      case "mastersthesis": {
        var school = get("school");
        out += quoteTitle(title);
        out += entry.type === "phdthesis" ? "Diss. " : "MA thesis. ";
        if (school) out += escapeHtml(school) + (year ? ", " + escapeHtml(year) : "") + ".";
        else if (year) out += escapeHtml(year) + ".";
        break;
      }
      case "techreport": {
        var institution = get("institution");
        out += "<i>" + escapeHtml(title) + "</i>. ";
        if (institution) out += escapeHtml(institution) + (year ? ", " + escapeHtml(year) : "") + ".";
        else if (year) out += escapeHtml(year) + ".";
        break;
      }
      default: {
        // misc / online / unpublished …；含 arXiv eprint 时按预印本排版
        var eprint = get("eprint");
        out += quoteTitle(title);
        if (eprint) {
          out += "arXiv preprint arXiv:" + escapeHtml(eprint) +
            (year ? " (" + escapeHtml(year) + ")" : "") + ".";
        } else {
          var how = get("howpublished");
          if (how) out += escapeHtml(how) + (year ? ", " + escapeHtml(year) : "") + ".";
          else if (year) out += escapeHtml(year) + ".";
        }
        break;
      }
    }

    // DOI / URL 作为尾注链接（bib 中有才输出）
    var doi = get("doi");
    var url = get("url");
    var href = "";
    if (doi) href = /^https?:/i.test(doi) ? doi : "https://doi.org/" + doi.replace(/^doi:/i, "");
    else if (url) href = url;
    if (href) out += ' <a href="' + escapeHtml(href) + '">' + escapeHtml(href) + "</a>.";

    return out.replace(/\s+$/, "");
  }

  /* ====================================================================
   * DOM 处理：替换 \cite{…} 并生成 References 一节
   * ================================================================== */

  var SKIP_TAGS = { PRE: 1, CODE: 1, KBD: 1, SAMP: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1 };
  var CITE_RE = /\\(no)?cite\s*\{([^{}]*)\}/g;

  /** 收集含 \cite / \nocite 的文本节点，跳过代码块与 MathJax 输出 */
  function collectTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeValue.indexOf("\\cite") < 0 && n.nodeValue.indexOf("\\nocite") < 0) {
          return NodeFilter.FILTER_REJECT;
        }
        for (var el = n.parentElement; el && el !== root; el = el.parentElement) {
          var tag = el.tagName || "";
          if (SKIP_TAGS[tag] || tag.slice(0, 4) === "MJX-" || /\bMathJax\b/.test(el.className)) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  var bibCache = {};
  function run(root) {
    var bibUrl = root.getAttribute("data-bib");
    if (!collectTextNodes(root).length) return; // 正文没有 \cite，无需请求 bib

    if (!bibCache[bibUrl]) bibCache[bibUrl] = fetch(bibUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " for " + bibUrl);
        return r.text();
      });
    bibCache[bibUrl].then(function (text) {
        // MathJax（async 加载）在 fetch 期间可能已排版含行内公式的段落，
        // 会把原文本节点拆分/替换而脱离 DOM；因此必须在 render 前重新收集节点。
        render(root, collectTextNodes(root), parseBibtex(text));
      })
      .catch(function (e) {
        console.warn("citations.js:", e);
      });
  }

  function render(root, nodes, entries) {
    var byKey = {};
    entries.forEach(function (e) {
      if (!(e.key in byKey)) byKey[e.key] = e;
    });

    var order = []; // 被引用的 key，按首次出现顺序
    var numOf = {};
    function numberFor(key) {
      if (!(key in numOf)) {
        order.push(key);
        numOf[key] = order.length;
      }
      return numOf[key];
    }

    // 排版结果缓存：tooltip 与文末列表共用
    var htmlCache = {};
    function htmlFor(key) {
      if (!(key in htmlCache)) htmlCache[key] = formatReference(byKey[key]);
      return htmlCache[key];
    }
    var scratch = document.createElement("div");
    function textFor(key) {
      scratch.innerHTML = htmlFor(key);
      return scratch.textContent;
    }

    function buildCitation(keys) {
      var span = document.createElement("span");
      span.className = "citation";
      span.appendChild(document.createTextNode("["));
      keys.forEach(function (key, i) {
        if (i) span.appendChild(document.createTextNode(","));
        if (byKey[key]) {
          var n = numberFor(key);
          var a = document.createElement("a");
          a.href = (root.getAttribute("data-reference-url") || "") + "#ref-" + n;
          a.textContent = n;
          a.title = textFor(key);
          span.appendChild(a);
        } else {
          // 同 LaTeX：未定义的引用显示 [?]
          console.warn("citations.js: undefined citation key '" + key + "'");
          var q = document.createElement("span");
          q.className = "citation-missing";
          q.title = (document.documentElement.getAttribute("data-undefined-cite") || "Undefined citation") + ": " + key;
          q.textContent = "?";
          span.appendChild(q);
        }
      });
      span.appendChild(document.createTextNode("]"));
      return span;
    }

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0;
      var m;
      CITE_RE.lastIndex = 0;
      while ((m = CITE_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        last = CITE_RE.lastIndex;
        var keys = m[2].split(",").map(function (k) { return k.trim(); }).filter(Boolean);
        if (m[1]) {
          // \nocite：只登记，不产生行内输出
          if (m[2].trim() === "*") {
            entries.forEach(function (e) { numberFor(e.key); });
          } else {
            keys.forEach(function (k) {
              if (byKey[k]) numberFor(k);
              else console.warn("citations.js: undefined citation key '" + k + "'");
            });
          }
        } else {
          frag.appendChild(buildCitation(keys));
        }
      }
      if (last === 0) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    if (!order.length || root.hasAttribute("data-reference-url")) return;

    var section = document.createElement("section");
    section.className = "paper-references";
    var h2 = document.createElement("h2");
    h2.className = "paper-references-title";
    // 标题按页面语言由模板写在 <html data-refs-title> 上
    h2.textContent = document.documentElement.getAttribute("data-refs-title") || "References";
    section.appendChild(h2);
    var ol = document.createElement("ol");
    ol.className = "references-list";
    order.forEach(function (key, idx) {
      var li = document.createElement("li");
      li.id = "ref-" + (idx + 1);
      li.innerHTML = htmlFor(key);
      ol.appendChild(li);
    });
    section.appendChild(ol);

    var body = root.querySelector('article[itemprop="articleBody"]') || root;
    body.appendChild(section);
    document.dispatchEvent(new Event("references:ready"));
  }

  /* ====================================================================
   * 启动（defer 脚本执行时 DOM 已就绪）；node 环境下仅导出供测试
   * ================================================================== */

  if (typeof document !== "undefined") {
    // Older cached article HTML supplies the bibliography on the script,
    // rather than on the article. Capture currentScript before deferred start.
    var legacyBibUrl = document.currentScript && document.currentScript.getAttribute("data-bib");
    function start() {
      if (legacyBibUrl) {
        var legacyRoot = document.querySelector('article[itemtype="http://schema.org/BlogPosting"]') ||
          document.querySelector('article[itemprop="articleBody"]');
        if (legacyRoot && !legacyRoot.hasAttribute("data-bib")) {
          legacyRoot.setAttribute("data-bib", legacyBibUrl);
        }
      }
      document.querySelectorAll("article[data-bib]").forEach(run);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      parseBibtex: parseBibtex,
      cleanLatex: cleanLatex,
      parseAuthors: parseAuthors,
      formatAuthorsMLA: formatAuthorsMLA,
      formatReference: formatReference,
    };
  }
})();
