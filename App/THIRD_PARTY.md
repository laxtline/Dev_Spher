# Sources and third-party notices

Pratice Code combines the local Code-Editor-Pro study/editor application with imported coding questions, company interview sheets, reference implementations and preparation documents.

- Original editor source: https://github.com/laxtline/Code-Editor-Pro
- The imported collections are identified in `data/import-report.json`; per-question and per-resource records retain their source links and relative source paths.
- Available top-level collection license/notice files are preserved in `third_party_notices/`.
- Runtime, editor and document licenses remain in `web/studio/vendor/` and `web/studio/offline/licenses/`.
- The Windows installer bundles the official Python 3.14.10 x64 embeddable distribution from `https://www.python.org/ftp/python/3.14.10/python-3.14.10-embed-amd64.zip`, verified against SHA-256 `90905e64a840557d8c1bc4f5b74db3d7ee85e3ffb217611cac1c7813acea4159`. Its license remains in the installed `runtime/` folder.
- The three DSA preparation PDF guides supplied for the Level wise tracks are preserved under `web/guides/`. The app's matching rules do not imply those documents contain an exhaustive list of company questions.
- The desktop edition includes Microsoft's WebView2 SDK and Fixed Version Runtime. Official URLs, versions and verified hashes are pinned in `windows/desktop-runtime.json`. Their original license/notice files are retained with the distributed binaries.

Third-party code, documents, questions and solutions retain their original authorship and licensing terms. A missing notice does not grant additional rights. The integration does not relicense those materials. Review the corresponding source and notices before redistributing an individual collection. Personal progress, notes, credentials and machine-specific import configuration are excluded from the release.

## Coding Lab 1.3 engines

- TypeScript 5.6.2 (Microsoft): Apache-2.0. Bundled compiler and license: `web/studio/vendor/typescript/`. Source: https://github.com/microsoft/TypeScript/tree/v5.6.2
- Mingo 6.7.2: MIT. Bundled MongoDB-compatible in-memory query engine and license: `web/studio/vendor/mingo/`. Source: https://github.com/kofrasa/mingo/tree/v6.7.2
- Additional online compilers are provided by Wandbox (https://wandbox.org/). Those languages require internet unless a matching local compiler is installed. Its compilers are not distributed with this app.
