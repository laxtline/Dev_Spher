# Pratice Code

One offline website for learning, coding, practice, assessments and your complete study collection.

## Open it

**Live website:** [Open Pratice Code](https://laxtline.github.io/Dev_Spher/). Python, JavaScript, SQL, web previews, lessons, exams and the study library run in your browser. Progress, notes and code stay in that browser; use **Progress → Back up all progress** to move them to another device. C/C++ and Java require the offline app and an installed compiler/JDK.

**Windows installer (v1.4.0):** [Download Pratice-Code-Setup.exe](https://github.com/laxtline/Dev_Spher/releases/download/v1.4.0/Pratice-Code-Setup.exe). [All downloads and checksums](https://github.com/laxtline/Dev_Spher/releases/latest).

**Windows desktop app:** download **Pratice-Code-Setup.exe** from [Releases](https://github.com/laxtline/Dev_Spher/releases). Run it, choose an install folder, then open the **Pratice Code** shortcut. It opens in its own application window, including coding, courses, exams, books and Level wise. The installer bundles Python, the Microsoft WebView2 fixed rendering runtime and the complete study collection; no separate Python, browser, Node.js or runtime download is needed. The installed app works without internet. The Windows portable build opens through **Pratice Code.exe** in the same way.

Double-click **Install and Start.cmd** (or **Start Pratice Code.cmd** after the first check). Open **http://127.0.0.1:8787/**. Keep the complete project folder together. Python 3.10+ is required; Node.js, npm and an internet connection are not required. **Stop Pratice Code.cmd** stops the local website.

## One application

The home page and the single top menu cover:

- **Coding Lab:** Monaco editing, Python, JavaScript, real SQLite, HTML/CSS/JS preview, saved snippets, file import/export and run history.
- **Practice:** local function-test suites and the retained judged input/output exercises. Equivalent question titles link their graded exercises and reference versions together.
- **Learn:** 30 courses, 145 lessons, worked examples, quizzes, notes and 446 interview answers from the retained curriculum.
- **Exams:** coding rounds, aptitude/written tests, coding challenges, SQL assessments, cognitive drills, interview prompts and company preparation.
- **Library → Questions & topics:** 11,143 catalog questions after merging 344 repeated records, combined with retained questions/topics for 11,748 visible entries. This includes the Python pack’s 404 complete questions (160 exercises and 244 supplied-PDF questions), 955 attributed title/link records, and questions or explicitly labeled review exercises derived from files/books. All 14,652 original resources link to question records; original material remains available through source links inside questions. The separate Files & books tab has been removed. Search by source, title, topic, company, difficulty and progress.
- **Library → Level wise:** the complete collection grouped into Easy, Medium, Hard and Unspecified, with source, topic, search and progress filters. Estimated difficulty is labeled. The three existing PDF-guided company preparation tracks remain under Company preparation. Every view reuses the same question IDs, notes, solutions and progress.
- **Progress:** coding, learning and reference practice in one place, including shared spaced revision and **Back up all progress / Restore progress**.

The main website uses one document and the same editor/learning engines. It does not embed the old websites in a second app frame. Browser history, deep links and a single navigation work across sections.

## Reading and running code

Open a reference question to read it, inspect solutions, edit your draft, keep notes and run code in the same page. The 22 existing local function suites support Python and JavaScript. The 160 original Python-pack exercises add 489 explicit test cases, with starter code, reference solutions and browser/local checking. Supplied-PDF answers are preserved without claiming independent verification. Other reference entries support custom function arguments and self-assessed progress. A reference implementation alone does not establish an automatically judged exercise. Local suites do not submit to an external platform or test every possible input.

Questions with a matching original input/output exercise show **Open input/output exercise** in the reader. The retained native exercise engine, exam sessions, scores and reference answers work as before. C/C++ and Java use an installed local compiler/JDK; missing compilers are labeled. This edition never sends code to a cloud compiler. External reference links are optional online sources.

## Saved work

The unified application uses the retained browser autosave and private folder backup at `studio-private/.codelab-data/progress.json`. Imported reference drafts, language choices, notes, bookmarks, attempts and revision join this same backup format. Existing personal records from the earlier question website migrate once without overwriting matching notes or drafts already present.

Choose **Progress → Back up all progress** to export one JSON backup containing the whole workspace. Restore through the same screen. Backups exclude compiler API credentials. Browser-only work from another origin/browser still needs its previous export/import controls.

The earlier `data/user-state.json` remains available for migration and compatibility. The importer does not erase it. Personal progress, private folder backups, import caches and logs are excluded from Git and from portable ZIP files.

## Add more material

Configure local folders in `import_sources.json`, then double-click **Merge New Files.cmd**. Refresh the website after the import. Matching links, numbers and titles are merged; identical files and implementations are skipped. Source paths and language variants stay with their records. Imported programs are not executed by the importer.

All usable content is copied into this project. The original Downloads folders are unnecessary for ordinary offline use. Company-sheet statistics remain historical snapshots dated 12 July 2025. Some older pre-existing renamed question IDs remain compatible with saved links.

## Portable package

Run `python package_offline.py` to build and verify `downloads/Pratice-Code-Offline.zip`. Extract the entire ZIP and use its launcher. The folder includes local Python/Pyodide, SQLite and Monaco browser engines and the complete study collection. Internet can be disconnected; the local launcher must stay running for library and code-runner APIs.

## Checks

- `python build_pages.py`: creates the public website in `dist/`, including the complete public catalog, reference files and bundled browser engines. Personal progress, private backups and executable runtimes are excluded. `.github/workflows/pages.yml` checks and publishes this build on every push to `main`.
- `node --test test_pages.cjs`: public catalog loading, Python function judging, runtime errors, timeouts and subpath-safe resource links.

- `python -m unittest test_server test_merge -v`: server, judging, wrong-answer/error/timeout behavior, shared saving, backup/restore, duplicate handling, compressed catalog reload, runtime files and inline script parsing.
- `node --test test_unified.cjs`: combined collection matching, implementation deduplication, preservation of saved status and bookmarks, graded-exercise linking, and reference practice in the shared revision system.
- The Windows installer is tested in a separate folder using only its bundled runtime, including launching/stopping its executable and submitting a Python practice solution.
- The home page, editor execution, courses, assessments, library, reference question workspace and deep-link reload are checked through the browser.

## Sources and notices

The original editor/study modules and their license notices remain under `web/studio/`, including its `vendor/` and `offline/licenses/` folders. Source and solution origins remain attached to imported records. Original project folders are retained separately. The app is a personal offline learning workspace; it does not install account-unlocking extensions or use an external platform login.

Additional collection notices and source information are listed in [THIRD_PARTY.md](THIRD_PARTY.md).

Local code runs with your computer account permissions and execution limits. The server listens only on 127.0.0.1. It is intended for personal use, not public multi-user hosting.

For installation on another computer, follow [INSTALL.md](INSTALL.md). On macOS/Linux run `python3 install.py` or `sh start.sh`. No original Downloads folders or saved browser data are required.

## Build the Windows installer

On Windows, run `python build_windows.py --download-runtime` once, or supply `--runtime-zip`, `--webview-sdk` and `--webview-cab` using the official packages pinned in `windows/desktop-runtime.json`. Their hashes are verified before packaging. The build uses Microsoft's local .NET Framework C# compiler and writes `downloads/Pratice-Code-Setup.exe`, `Pratice-Code-Windows-Portable.zip` and a checksum. No build tools or downloads are needed by the person installing the finished app. Original runtime and SDK licenses are retained. Desktop profile data stays under `studio-private/desktop-profile/`, alongside the private shared progress backup. Closing the app flushes saved work and stops its owned local server.

## Web library update · 1 November 2026

The web library update is included in desktop version 1.4.0. Questions, source versions, aliases and saved-progress compatibility use the same implementation in the web and desktop editions.

The working pack directory contains authoring scripts and an earlier extraction of the same 244 PDF questions. It is inventoried as a source; scripts are not executed or presented as extra questions.

`expand_library.py` rebuilds the additional records with stable IDs. Run it with an authoring Python that has `pypdf` installed. Existing source files and user progress are preserved. Book extraction retains page text under `data/book-extractions/`; questions link to the bundled original PDFs. `data/library-expansion-report.json` records coverage and how each kind of material was handled.

`python verify_library_expansion.py` checks all resource/question links and runs the 160 original pack suites (489 cases) without changing progress. The expansion regression checks are `python -m unittest test_expansion test_merge -v` and `node --test test_unified.cjs test_pages.cjs`.

Repeated titles and confirmed renamed questions are consolidated by `python deduplicate_library.py`. Original statements, answers, source links and solutions remain as source versions under the same question. Old IDs remain aliases so saved links, notes, drafts and progress still resolve. Run this after future expansions. The UI also merges equivalent retained topics. See `data/library-deduplication-report.json`.

A source checkout contains the desktop code and build inputs. Install the Windows release for the bundled WebView2 rendering runtime.
