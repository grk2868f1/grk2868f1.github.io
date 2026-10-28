#!/usr/bin/env python3
"""构建产物的链接检查：站内链接与锚点、内容里写死的本站网址、旧网址跳转页。

用法（先 zola build --output-dir "$SITE" --force）：
    python3 util/check_links.py "$SITE"                              # 检查
    python3 util/check_links.py "$SITE" --write-baseline FILE        # 记录现有问题
    python3 util/check_links.py "$SITE" --baseline FILE \
        --redirects util/i18n_redirects.tsv                          # 只报新问题

每个问题输出一行：类别<TAB>位置<TAB>目标。存在 baseline 之外的问题时退出码为 1。
只用标准库。
"""
import argparse
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit

DEFAULT_BASE = "https://grk2868f1.github.io"
URL_ATTRS = ("href", "src", "data-bib")
SKIP_PREFIXES = ("mailto:", "javascript:", "data:", "tel:")


class _PageParser(HTMLParser):
    """收集一个 HTML 页面里的链接，以及可作为锚点的 id / <a name>。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.anchors = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if value is None:
                continue
            if name == "id" or (name == "name" and tag == "a"):
                self.anchors.add(value)
            elif name in URL_ATTRS:
                self.links.append(value.strip())
            elif name == "srcset":
                for candidate in value.split(","):
                    url = candidate.strip().split(" ")[0]
                    if url:
                        self.links.append(url)

    handle_startendtag = handle_starttag


def _parse(path):
    parser = _PageParser()
    with open(path, encoding="utf-8", errors="replace") as f:
        parser.feed(f.read())
    return parser


def target_file(site, path):
    """站内 URL 路径 → 构建目录里的文件；目录对应其 index.html。"""
    rel = path.lstrip("/")
    full = os.path.join(site, rel)
    if path.endswith("/") or rel == "" or os.path.isdir(full):
        return os.path.join(full, "index.html")
    return full


def page_path(site, html_file):
    """构建目录里的 HTML 文件 → 它在站点上的 URL 路径。"""
    rel = os.path.relpath(html_file, site).replace(os.sep, "/")
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def _html_files(site):
    for dirpath, _dirs, files in os.walk(site):
        for name in files:
            if name.endswith(".html"):
                yield os.path.join(dirpath, name)


def check_site(site, base):
    """检查所有页面里指向本站的链接：目标文件存在；带锚点的还要求锚点存在。"""
    netloc = urlsplit(base).netloc
    cache = {}
    problems = set()

    def parsed(path):
        if path not in cache:
            cache[path] = _parse(path)
        return cache[path]

    for html_file in _html_files(site):
        where = page_path(site, html_file)
        page_url = base + where
        for link in parsed(html_file).links:
            if not link or link.startswith(SKIP_PREFIXES):
                continue
            parts = urlsplit(urljoin(page_url, link))
            if parts.scheme not in ("http", "https") or parts.netloc != netloc:
                continue
            path = unquote(parts.path) or "/"
            target = target_file(site, path)
            if not os.path.isfile(target):
                problems.add(("BROKEN_LINK", where, path))
                continue
            fragment = unquote(parts.fragment)
            if fragment and target.endswith(".html") and fragment not in parsed(target).anchors:
                problems.add(("BROKEN_ANCHOR", where, path + "#" + fragment))
    return problems


def check_content(content, site, base):
    """内容源文件里写死的本站完整网址，目标必须出现在构建产物里。"""
    netloc = urlsplit(base).netloc
    pattern = re.compile(r"https?://" + re.escape(netloc) + r"(/[^\s)\"'<>\]]*)?")
    problems = set()
    for dirpath, _dirs, files in os.walk(content):
        for name in files:
            if not name.endswith(".md"):
                continue
            md = os.path.join(dirpath, name)
            rel = os.path.relpath(md, content).replace(os.sep, "/")
            with open(md, encoding="utf-8") as f:
                text = f.read()
            for match in pattern.finditer(text):
                path = (match.group(1) or "/").rstrip(".,;:!?")
                path = unquote(path.split("#", 1)[0]) or "/"
                if not os.path.isfile(target_file(site, path)):
                    problems.add(("BROKEN_CONTENT_URL", rel, path))
    return problems


def load_redirects(manifest):
    """读取 旧路径<TAB>新路径 清单，跳过空行和 # 注释行。"""
    pairs = []
    with open(manifest, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                old, new = line.split("\t")
                pairs.append((old, new))
    return pairs


def _is_redirect(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return "<title>Redirect</title>" in f.read()


def check_redirects(site, base, pairs):
    """每个旧网址都要有 Zola alias 生成的跳转页且指向新网址；新网址必须是真实页面。"""
    problems = set()
    for old, new in pairs:
        old_file = target_file(site, old)
        if not os.path.isfile(old_file):
            problems.add(("BAD_REDIRECT", old, "missing alias page"))
        else:
            with open(old_file, encoding="utf-8") as f:
                if f'const target = "{base}{new}"' not in f.read():
                    problems.add(("BAD_REDIRECT", old, f"does not point to {new}"))
        new_file = target_file(site, new)
        if not os.path.isfile(new_file):
            problems.add(("BAD_REDIRECT", old, f"target {new} missing"))
        elif _is_redirect(new_file):
            problems.add(("BAD_REDIRECT", old, f"target {new} is itself a redirect"))
    return problems


def _normalize(line, pairs):
    """把迁移后的新路径前缀换回旧路径，便于与迁移前记录的 baseline 对比。"""
    for old, new in sorted(pairs, key=lambda p: -len(p[1])):
        line = line.replace(new, old)
    return line


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("site")
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--content", default="content", help="内容目录；传空字符串跳过")
    parser.add_argument("--redirects", help="旧路径<TAB>新路径 清单")
    parser.add_argument("--baseline", help="迁移前记录的问题清单，其中的问题不计为失败")
    parser.add_argument("--write-baseline", help="把当前全部问题写入该文件后退出")
    args = parser.parse_args(argv)

    base = args.base_url.rstrip("/")
    pairs = load_redirects(args.redirects) if args.redirects else []
    problems = check_site(args.site, base)
    if args.content:
        problems |= check_content(args.content, args.site, base)
    problems |= check_redirects(args.site, base, pairs)
    lines = sorted("\t".join(p) for p in problems)

    if args.write_baseline:
        with open(args.write_baseline, "w", encoding="utf-8") as f:
            f.write("".join(line + "\n" for line in lines))
        print(f"wrote {len(lines)} problems to {args.write_baseline}", file=sys.stderr)
        return 0

    known = set()
    if args.baseline:
        with open(args.baseline, encoding="utf-8") as f:
            known = {line.rstrip("\n") for line in f if line.strip()}
    new = [line for line in lines if _normalize(line, pairs) not in known]
    for line in new:
        print(line)
    print(f"{len(new)} new problems, {len(lines) - len(new)} pre-existing (baseline)",
          file=sys.stderr)
    return 1 if new else 0


if __name__ == "__main__":
    sys.exit(main())
