# Dev Sphere · Pratice Code

Pratice Code is an offline coding and study workspace. Use the Windows desktop app or run the bundled local website. The library includes **11,748 questions and topics** with linked source materials, exercises, solutions, and study progress.

## Downloads

- [Windows installer](https://github.com/laxtline/Dev_Spher/releases/download/v1.4.0/Pratice-Code-Setup.exe)
- [Offline website ZIP](https://github.com/laxtline/Dev_Spher/releases/download/v1.4.0/Pratice-Code-Offline.zip)
- [Release notes and SHA-256 checksums](https://github.com/laxtline/Dev_Spher/releases/tag/v1.4.0)
- [Live study website](https://laxtline.github.io/Dev_Spher/)
- [GitHub Packages](https://github.com/users/laxtline/packages?repo_name=Dev_Spher)

Run the installer and open **Pratice Code** from the Start menu. For the offline website, extract the whole ZIP and run **Install and Start.cmd**. The bundled local runtimes support Python, JavaScript, TypeScript, SQLite and web previews. Some other languages require a local compiler.

## Project layout

| Path | Contents |
| --- | --- |
| `App/` | Windows app source, embedded Python, editor and study library |
| `Website/` | Local website, study library, browser engines and tests |
| `Installer/` | Installer build information |
| `Publish/` | Release notes and build tools |
| `Start.pdf` | Quick-start guide |

Run `OPEN_WEBSITE.cmd` from a source checkout to launch the local website. The Windows installer includes the fixed WebView2 runtime and Python. See [Website/README.md](Website/README.md) for setup and verification commands. The release installer and offline ZIP are distributed through Releases.

## GitHub Packages

The Maven package `com.github.laxtline:dev-spher-windows:1.4.0` with type `exe` contains the Windows installer. Maven downloads from GitHub Packages require authentication.

## Saved work and sources

The app creates local progress files as you work. Repository and release downloads exclude personal progress, local import settings, and runtime logs. Project and third-party notices are in [App/THIRD_PARTY.md](App/THIRD_PARTY.md) and [Website/THIRD_PARTY.md](Website/THIRD_PARTY.md).
