"""check_links.py 的单元测试。运行：python3 -m unittest discover -s util -p 'test_check_links.py' -v"""
import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_links as cl  # noqa: E402

BASE = "https://example.test"


def write(root, rel, text):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


class _TmpCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.site = os.path.join(self.tmp.name, "site")
        self.content = os.path.join(self.tmp.name, "content")
        os.makedirs(self.site)
        os.makedirs(self.content)

    def tearDown(self):
        self.tmp.cleanup()

    def alias(self, old, target):
        write(
            self.site,
            old.strip("/") + "/index.html",
            '<!doctype html>\n<title>Redirect</title>\n<script>\n'
            f'  const target = "{target}";\n</script>\n',
        )


class CheckSiteTest(_TmpCase):
    def test_valid_links_produce_no_problems(self):
        write(self.site, "index.html",
              '<a href="/posts/a/">a</a>'
              '<a href="https://example.test/posts/a/#sec">s</a>'
              '<img src="posts/a/x.png">'
              '<a href="https://other.test/missing">ext</a>'
              '<a href="mailto:x@y.z">m</a><a href="#">top</a>')
        write(self.site, "posts/a/index.html",
              '<h2 id="sec">S</h2><img srcset="x.png 1x, x.png 2x">'
              '<article data-bib="https://example.test/posts/a/refs.bib"></article>')
        write(self.site, "posts/a/x.png", "png")
        write(self.site, "posts/a/refs.bib", "@misc{x}")
        self.assertEqual(cl.check_site(self.site, BASE), set())

    def test_reports_missing_file_and_missing_anchor(self):
        write(self.site, "index.html",
              '<a href="/posts/missing/">m</a><a href="/posts/a/#nope">n</a>')
        write(self.site, "posts/a/index.html", '<h2 id="sec">S</h2>')
        self.assertEqual(cl.check_site(self.site, BASE), {
            ("BROKEN_LINK", "/", "/posts/missing/"),
            ("BROKEN_ANCHOR", "/", "/posts/a/#nope"),
        })

    def test_relative_links_resolve_against_page_url(self):
        write(self.site, "posts/a/index.html",
              '<img src="assets/x.png"><img src="assets/gone.png">')
        write(self.site, "posts/a/assets/x.png", "png")
        self.assertEqual(cl.check_site(self.site, BASE),
                         {("BROKEN_LINK", "/posts/a/", "/posts/a/assets/gone.png")})

    def test_same_page_anchor_is_checked(self):
        write(self.site, "index.html",
              '<a href="#here">h</a><a href="#gone">g</a><p id="here"></p>')
        self.assertEqual(cl.check_site(self.site, BASE),
                         {("BROKEN_ANCHOR", "/", "/#gone")})


class CheckContentTest(_TmpCase):
    def test_reports_hardcoded_site_urls_missing_from_build(self):
        write(self.content, "posts/a/index.md",
              "[ok](https://example.test/posts/a/) and "
              "[bad](https://example.test/posts/b/assets/f.zip).")
        write(self.site, "posts/a/index.html", "")
        self.assertEqual(cl.check_content(self.content, self.site, BASE),
                         {("BROKEN_CONTENT_URL", "posts/a/index.md", "/posts/b/assets/f.zip")})


class CheckRedirectsTest(_TmpCase):
    def test_valid_redirect(self):
        self.alias("/posts/a/", BASE + "/en/posts/a/")
        write(self.site, "en/posts/a/index.html", "<p>ok</p>")
        self.assertEqual(cl.check_redirects(self.site, BASE, [("/posts/a/", "/en/posts/a/")]), set())

    def test_redirect_problems(self):
        self.alias("/posts/b/", BASE + "/en/posts/x/")
        write(self.site, "en/posts/b/index.html", "<p>ok</p>")
        self.alias("/posts/c/", BASE + "/en/posts/c/")
        pairs = [("/posts/a/", "/en/posts/a/"),
                 ("/posts/b/", "/en/posts/b/"),
                 ("/posts/c/", "/en/posts/c/")]
        write(self.site, "en/posts/a/index.html", "<p>ok</p>")
        self.assertEqual(cl.check_redirects(self.site, BASE, pairs), {
            ("BAD_REDIRECT", "/posts/a/", "missing alias page"),
            ("BAD_REDIRECT", "/posts/b/", "does not point to /en/posts/b/"),
            ("BAD_REDIRECT", "/posts/c/", "target /en/posts/c/ missing"),
        })

    def test_load_redirects_skips_comments(self):
        manifest = os.path.join(self.tmp.name, "r.tsv")
        write(self.tmp.name, "r.tsv", "# 注释\n\n/posts/a/\t/en/posts/a/\n")
        self.assertEqual(cl.load_redirects(manifest), [("/posts/a/", "/en/posts/a/")])


class MainTest(_TmpCase):
    def run_main(self, *extra):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            rc = cl.main([self.site, "--base-url", BASE, "--content", "", *extra])
        return rc, out.getvalue()

    def test_baseline_suppresses_moved_preexisting_problems(self):
        write(self.site, "en/posts/a/index.html", '<img src="gone.png">')
        self.alias("/posts/a/", BASE + "/en/posts/a/")
        write(self.tmp.name, "r.tsv", "/posts/a/\t/en/posts/a/\n")
        write(self.tmp.name, "baseline.txt", "BROKEN_LINK\t/posts/a/\t/posts/a/gone.png\n")
        args = ["--redirects", os.path.join(self.tmp.name, "r.tsv"),
                "--baseline", os.path.join(self.tmp.name, "baseline.txt")]
        rc, out = self.run_main(*args)
        self.assertEqual((rc, out), (0, ""))

        write(self.site, "en/posts/a/index.html", '<img src="gone.png"><img src="new.png">')
        rc, out = self.run_main(*args)
        self.assertEqual(rc, 1)
        self.assertEqual(out, "BROKEN_LINK\t/en/posts/a/\t/en/posts/a/new.png\n")

    def test_write_baseline(self):
        write(self.site, "index.html", '<a href="/nope/">x</a>')
        path = os.path.join(self.tmp.name, "b.txt")
        rc, _ = self.run_main("--write-baseline", path)
        self.assertEqual(rc, 0)
        with open(path, encoding="utf-8") as f:
            self.assertEqual(f.read(), "BROKEN_LINK\t/\t/nope/\n")


if __name__ == "__main__":
    unittest.main()
