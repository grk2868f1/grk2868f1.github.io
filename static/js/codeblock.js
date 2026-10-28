/**
 * @file This script adds a copy button to code blocks in a webpage. It allows
 * users to copy code snippets to the clipboard with a visual confirmation. It
 * also supports code blocks formatted as tables with line numbers.
 */

/**
 * Code copy button success icon
 */
const successIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="bi bi-check-lg" viewBox="0 0 16 16">
            <path d="M13.485 1.85a.5.5 0 0 1 1.065.02.75.75 0 0 1-.02 1.065L5.82 12.78a.75.75 0 0 1-1.106.02L1.476 9.346a.75.75 0 1 1 1.05-1.07l2.74 2.742L12.44 2.92a.75.75 0 0 1 1.045-.07z"/>
        </svg>`;

/**
 * Code copy button error icon
 */
const errorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="bi bi-x-lg" viewBox="0 0 16 16">
            <path d="M2.293 2.293a1 1 0 0 1 1.414 0L8 6.586l4.293-4.293a1 1 0 0 1 1.414 1.414L9.414 8l4.293 4.293a1 1 0 0 1-1.414 1.414L8 9.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L6.586 8 2.293 3.707a1 1 0 0 1 0-1.414z"/>
        </svg>`;

/**
 * Code copy button clipboard icon
 */
const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
</svg>`;

/**
 * Code collapse button expand icon (down arrow)
 */
const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="6,9 12,15 18,9"></polyline>
</svg>`;

/**
 * Code collapse button collapse icon (up arrow)
 */
const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="18,15 12,9 6,15"></polyline>
</svg>`;

/**
 * Function to change the icon of the copy button based on success or error.
 *
 * @param {HTMLElement} button - The button element to change the icon for.
 * @param {boolean} isSuccess - If true, show success icon; if false, show error icon.
 * @return {void}
 */
const changeIcon = (button, isSuccess) => {
  button.innerHTML = isSuccess ? successIcon : errorIcon;
  setTimeout(() => {
    button.innerHTML = copyIcon; // Reset to copy icon
  }, 2000);
};

/**
 * Extracts code from a table format, ignoring line numbers
 * @param {HTMLElement} codeBlock - The code block element containing the table.
 * @return {string} - The extracted code as a string, with each line separated by a newline character.
 * @example // Assuming codeBlock is a <pre><code> element containing a table
 * getCodeFromTable(codeBlock);
 */
const getCodeFromTable = (codeBlock) => {
  return [...codeBlock.querySelectorAll("tr")]
    .map((row) => {
      const codeCell = row.querySelector("td:last-child");
      return codeCell ? codeCell.textContent.trimEnd() : "";
    })
    .join("\n");
};

/**
 * Extracts code from a non-table format code block
 * @param {HTMLElement} codeBlock - The code block element containing the code.
 * @return {string} - The extracted code as a string.
 * @example // Assuming codeBlock is a <pre><code> element
 * getNonTableCode(codeBlock);
 */
const getNonTableCode = (codeBlock) => {
  return codeBlock.textContent.trim();
};

// 等待所有资源加载完成（包括字体）后再初始化按钮
function initCodeBlocks() {
  // Mapping from language codes to display names. Keys cover both common
  // shorthand (e.g. `js`) and the longer identifiers that Zola's Giallo
  // highlighter emits via `data-lang` (e.g. `shellscript`, `fortran-free-form`).
  const languageNames = {
    // Web
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    html: "HTML",
    xml: "XML",
    css: "CSS",
    scss: "SCSS",
    sass: "Sass",
    less: "Less",
    // Data / config
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    ini: "INI",
    csv: "CSV",
    // Shells
    shell: "Shell",
    shellscript: "Shell",
    bash: "Bash",
    sh: "sh",
    zsh: "Zsh",
    fish: "Fish",
    powershell: "PowerShell",
    // Systems / compiled
    c: "C",
    cpp: "C++",
    "c++": "C++",
    objc: "Objective-C",
    "objective-c": "Objective-C",
    csharp: "C#",
    "c#": "C#",
    rust: "Rust",
    go: "Go",
    fortran: "Fortran",
    "fortran-free-form": "Fortran",
    "fortran-fixed-form": "Fortran",
    f90: "Fortran",
    f95: "Fortran",
    asm: "Assembly",
    // Scripting / dynamic
    python: "Python",
    py: "Python",
    ruby: "Ruby",
    rb: "Ruby",
    perl: "Perl",
    php: "PHP",
    lua: "Lua",
    r: "R",
    julia: "Julia",
    matlab: "MATLAB",
    octave: "Octave",
    // JVM / others
    java: "Java",
    kotlin: "Kotlin",
    scala: "Scala",
    groovy: "Groovy",
    swift: "Swift",
    dart: "Dart",
    elixir: "Elixir",
    erlang: "Erlang",
    haskell: "Haskell",
    clojure: "Clojure",
    ocaml: "OCaml",
    fsharp: "F#",
    "f#": "F#",
    // Markup / docs
    markdown: "Markdown",
    md: "Markdown",
    rst: "reST",
    tex: "TeX",
    latex: "LaTeX",
    bibtex: "BibTeX",
    // Misc
    sql: "SQL",
    diff: "Diff",
    patch: "Patch",
    dockerfile: "Dockerfile",
    docker: "Dockerfile",
    makefile: "Makefile",
    cmake: "CMake",
    nix: "Nix",
    gd: "GDScript",
    vim: "Vim",
    viml: "Vim",
    mermaid: "Mermaid",
    graphql: "GraphQL",
    // Plain
    text: "Text",
    plain: "Text",
    plaintext: "Text",
    txt: "Text",
  };

  // Aliases mapping verbose Giallo lang ids and common shorthand to the keys
  // used by $language-colors in sass/parts/_code.scss. This keeps brand colors
  // working without duplicating the SCSS color map.
  const langClassAliases = {
    shellscript: "shell",
    zsh: "shell",
    fish: "shell",
    viml: "vim",
    "fortran-free-form": "fortran",
    "fortran-fixed-form": "fortran",
    f90: "fortran",
    f95: "fortran",
    plain: "text",
    plaintext: "text",
    txt: "text",
    javascript: "js",
    typescript: "typescript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    md: "markdown",
    "c++": "cpp",
    "c#": "csharp",
    "objective-c": "objc",
  };

  // Select all `pre` elements containing `code`
  document.querySelectorAll("pre code").forEach((codeBlock) => {
    const pre = codeBlock.parentNode;

    // 检查是否已经初始化过（防止重复添加按钮）
    if (pre.hasAttribute('data-code-block-initialized')) {
      return;
    }
    
    // 标记为已初始化
    pre.setAttribute('data-code-block-initialized', 'true');

    // 用一层 wrapper 把 <pre> 包起来，按钮 / 语言标签挂在 wrapper 上而不是
    // <pre> 里面。<pre> 自己是滚动容器（overflow-x/y: auto），放在它内部的
    // 绝对定位元素会跟着内容一起滚走；挂到外层就天然固定，不需要任何 JS 补偿。
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    // Create and append the copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "clipboard-button";
    copyBtn.innerHTML = copyIcon;
    copyBtn.setAttribute("aria-label", "Copy code to clipboard");
    wrapper.appendChild(copyBtn);

    // Create and append the collapse button
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "collapse-button";
    collapseBtn.innerHTML = collapseIcon;
    collapseBtn.setAttribute("aria-label", "Collapse code block");
    wrapper.appendChild(collapseBtn);

    // Create and append the language label.
    // Zola 0.22+ (Giallo highlighter) emits `<code data-lang="python">`;
    // older syntect-based highlighters used `class="language-python"`.
    // Read both so the label works regardless of which engine is in use.
    const dataLang = codeBlock.dataset.lang;
    const langClass = codeBlock.className.match(/language-([\w-]+)/);
    const langCode = (dataLang || (langClass && langClass[1]) || "text").toLowerCase();
    // Map verbose / aliased lang ids to the keys used by $language-colors in
    // sass/parts/_code.scss so the brand color still applies. Anything not
    // listed here falls back to the neutral gray defined on `.code-label`.
    const langCssAlias = langClassAliases[langCode] || langCode;
    const sanitizedClass = langCssAlias.replace(/[^a-z0-9-]/g, "-");
    const label = document.createElement("span");
    label.className = "code-label label-" + sanitizedClass;
    label.textContent = languageNames[langCode] || langCode.toUpperCase();
    wrapper.appendChild(label);

    // 纵向滚动条会占掉 <pre> 右侧一段宽度。按钮现在相对 wrapper（= <pre> 的
    // 边框盒）定位，如果不把这段宽度让出来就会压在滚动条上，所以把实测宽度
    // 写进 CSS 变量，由 _code.scss 里的 right: calc(... + var(...)) 消费。
    const syncScrollbarWidth = () => {
      const gutter = pre.offsetWidth - pre.clientWidth;
      wrapper.style.setProperty("--code-scrollbar-width", `${gutter}px`);
    };
    syncScrollbarWidth();
    if (window.ResizeObserver) {
      new ResizeObserver(syncScrollbarWidth).observe(pre);
    }

    // Attach event listener to collapse button
    collapseBtn.addEventListener("click", () => {
      const isCollapsed = pre.classList.contains("collapsed");
      
      if (isCollapsed) {
        pre.classList.remove("collapsed");
        collapseBtn.innerHTML = collapseIcon;
        collapseBtn.setAttribute("aria-label", "Collapse code block");
      } else {
        pre.classList.add("collapsed");
        collapseBtn.innerHTML = expandIcon;
        collapseBtn.setAttribute("aria-label", "Expand code block");
      }
    });

    // Attach event listener to copy button
    copyBtn.addEventListener("click", async () => {
      try {
        // Check if the code is in a table (line numbers)
        const isTableFormat = codeBlock.querySelector("table") !== null;

        // Get the appropriate code text
        const codeToCopy = isTableFormat
          ? getCodeFromTable(codeBlock)
          : getNonTableCode(codeBlock);

        await navigator.clipboard.writeText(codeToCopy);
        changeIcon(copyBtn, true); // Show success icon
      } catch (error) {
        console.error("Failed to copy text: ", error);
        changeIcon(copyBtn, false); // Show error icon
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // 延迟一小段时间，确保CSS和字体已应用
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initCodeBlocks();
    });
  });
});
