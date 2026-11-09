# Install Pratice Code

## Windows installer (recommended)

Download **Pratice-Code-Setup.exe** from the [GitHub Releases page](https://github.com/laxtline/Pratice-Code/releases), run it and choose a dedicated install folder. The default is `%LOCALAPPDATA%\Programs\PraticeCode`. Setup can create Desktop and Start menu shortcuts. Open **Pratice Code** to start the desktop app. Coding, courses, tests, questions and PDFs open inside its own application windows. The local service starts automatically in the background; the main app does not launch your browser.

This Windows x64 edition includes Python, a fixed Microsoft WebView2 rendering runtime and all application content. Installation and ordinary use need no internet, browser setup, Python setup, Node.js or administrator access. Windows 10/11 with .NET Framework 4.7.2+ support is required. C/C++ and Java still use an optional local compiler/JDK.

For a portable Windows copy, extract **Pratice-Code-Windows-Portable.zip** and open **Pratice Code.exe**. Keep the extracted folder together. Personal notes, credentials and progress are not included in distributed packages. Before updating an installed copy, close its server; retain `studio-private/` and export your progress through the app.

## Source ZIP / macOS / Linux

1. Install Python **3.10 or newer** once. No Node.js, npm, account or paid service is required.
2. Download the repository ZIP or the full offline ZIP and **extract the complete folder**.
3. On Windows, double-click **Install and Start.cmd**. On macOS/Linux, run `python3 install.py` from that folder, or `sh start.sh`.
4. Your browser opens **http://127.0.0.1:8787/**. The internet can be disconnected. Keep the folder and local server available while using the site.

The installer checks the folder and opens the site; it does not download software or change system settings. `python install.py --check` runs the check without opening a browser. `python launch.py --stop` stops the app.

Included offline: courses, notes, quizzes, interviews, mock sessions, the question/reference library, PDF books, Monaco editing, Python, JavaScript, SQLite and HTML/CSS/JavaScript previews. Optional C/C++ and Java execution needs an installed local compiler/JDK; those languages never fall back to a cloud compiler in this edition. Their reference code remains readable without a compiler. External source links open online only when you choose them.

Progress is private to your browser and local folder. Use **Progress → Back up all progress** before moving to another computer, and restore the JSON there. Downloaded application ZIPs intentionally omit personal notes, answers and progress.

To import your own files, copy `import_sources.example.json` to `import_sources.json`, enter your local folder paths, then run `python merge_packs.py`. Bundled study content works without the original source folders.
