# Fortran syntax highlighting

The free-form Fortran grammar is from [fortran-lang/vscode-fortran-support](https://github.com/fortran-lang/vscode-fortran-support), commit `1c8b212318a7c9e000f2e937df18bab1953ff365`, file `syntaxes/fortran_free-form.tmLanguage.json`. It is distributed under the MIT license in `LICENSE`.

The only local change is the top-level name from `Fortran - Free Form` to `Fortran`, so Zola recognizes existing `fortran` code fences. Register it through `markdown.highlighting.extra_grammars` in `config.toml`.
