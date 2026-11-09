# StudyLab - isi folder se online aur offline use

App, questions, diagrams, Python/SQL engines aur editor isi folder mein hain.
`assets/`, `vendor/` aur `offline/` ko saath rakho. Installed copy ko internet ki zarurat nahi hai for the supported offline features.

## Option 1: VS Code Live Server

1. VS Code mein **File > Open Folder** se poora `Code-Editor-Pro` folder kholo.
2. `index.html` par right-click > **Open with Live Server**.
3. Vivaldi mein `http://127.0.0.1:5500/index.html` kholo. Is computer ki project settings Vivaldi ke liye configured hain.
4. Ab internet disconnect karke practice kar sakte ho. VS Code aur Live Server running rehne chahiye.

Live Server already running ho aur Vivaldi kholna ho to isi folder ke PowerShell terminal mein:

```powershell
.\Start-CodeLab-Vivaldi.ps1 -LiveServer
```

Live Server alag port use kare to `-LiveServer -Port 5501` use karo.

## Option 2: PowerShell se direct Vivaldi

Is project folder ke terminal mein:

```powershell
.\Start-CodeLab-Vivaldi.ps1
```

Ya kisi bhi PowerShell folder se:

```powershell
& "D:\Coding\Code-Editor-Pro\Start-CodeLab-Vivaldi.ps1"
```

Script Vivaldi auto-detect karta hai aur localhost server background mein start karta hai.
Python 3 installed hona chahiye; npm/internet/VS Code ki zarurat nahi hai.
Terminal close kar sakte ho; server background mein running rahega.
Same launcher dobara run karne par existing verified server reuse hota hai.
Default port 4173 hai; busy hua to next available port use hota hai. Printed URL ko use karo.

Server band karne ke liye:

```powershell
.\Start-CodeLab-Vivaldi.ps1 -Stop
```

Vivaldi custom/portable location par ho to:

```powershell
.\Start-CodeLab-Vivaldi.ps1 -VivaldiPath "E:\Vivaldi\Application\vivaldi.exe"
```

Browser khole bina server start/check karna ho:

```powershell
.\Start-CodeLab-Vivaldi.ps1 -NoBrowser
```

## Offline mein kya chalega?

- Written tests, aptitude/reasoning/verbal questions, formulas, explanations aur exams.
- Complete bundled Offline Library, diagrams, solutions, notes aur drafts.
- JavaScript, Python ke bundled standard-library modules, SQLite SQL aur HTML/CSS preview.
- Monaco editor, local saving, reports aur Export/Import Progress.
- Launcher se C/C++ offline run hoga agar GCC/Clang installed hai; Java ke liye JDK chahiye. Restart launcher after installation. Live Server/GitHub Pages par in languages ka cloud compiler internet use karta hai. External reference links bhi online hain.
- Native programs aapke account permissions se run hote hain; time/output limits hain, OS sandbox nahi. Java code mein public class Main use karo.
- Study Material ke DSA, Python, Web Development, AI/ML, Core CS aur other subject pages, notes, exercises aur interview answers offline bundled hain.
- My Study mein daily goals, streak, weak topics aur 1/3/7/14-day revision queue hai.
- Extra Python packages bundled nahi hain.

`CodeLab-Offline.html` double-click se lightweight MCQ/theory/library/JavaScript edition khol sakte ho.
Full offline Python/SQL/editor ke liye Live Server ya launcher use karo.

## Progress aur backup

Progress browser aur address/port ke hisaab se save hota hai. Vivaldi aur doosre browsers ka progress alag hai.
`127.0.0.1:5500`, `127.0.0.1:4173`, `localhost` aur GitHub Pages alag storage origins hain.
Online aur offline dono mein browser autosave immediate hai. Launcher additionally isi folder ke private `.codelab-data/progress.json` mein automatic backup karta hai. Same folder ke launcher ports is backup se saved items restore/merge karte hain. Is private folder ko backup ke liye copy kar sakte ho; GitHub ya public host par upload mat karo.

Live Server automatic folder backup nahi likhta. GitHub Pages, Live Server aur different devices ke beech move karte waqt **Export all progress**, phir **Import progress** use karo. Automatic cloud/device sync configured nahi hai. Nav mein Save status ya Settings se saving details khol sakte ho.

Browser aur folder ke purane matching items different hon to Save status mein Keep browser / Restore folder choose kar sakte ho. Backup writing fail ho to browser copy retained rahegi aur folder retry hoga.
Backup mein latest editor draft, notes aur reports aate hain; compiler API credentials export nahi hote.
Import matching saved items replace karta hai. Pehle current work export kar lo, aur running test ko finish ya save/leave karo.
Purane StudyLab JSON backups bhi import kar sakte ho.

## GitHub se online

GitHub Pages deployment ke baad online app bhi same features use karegi.
Deployment workflow `.github/workflows/pages.yml` aur instructions `README.md` mein hain.
Online version mein **Online / Offline > Save full app for offline** bhi available hai.
Naya version lene ke liye **Check for updates**, phir **Apply update & reload** use karo.
Pehle active session finish/save-and-leave karo aur doosre StudyLab tabs/windows band karo.
Update ke baad full app dobara offline save karo. Alag ZIP folder update karne ke liye latest ZIP download/extract karo.
Purane version mein update button na ho to saare StudyLab tabs band karke online dobara kholo.
GitHub deployment ka status repository ke Actions tab mein check karo. Local use independent hai.

## Navigation aur resume

Top ke Back/Forward buttons ya browser history use karo. Active test se leave karne par answers, code aur original deadline saved rehte hain; time away bhi deadline mein count hota hai. Session URL reload karne par saved round resume hoga. Lesson notes/code type karte hi save hote hain; important work ka Export bhi rakho.

## Latest StudyLab screen

Purana CodeLab screen ya “Update ready” dikh raha ho to isi server address par `update.html` kholo. Active test finish/save-and-leave karo, doosre StudyLab tabs/windows band karo, phir **Check and apply update** dabao. Browser storage ya saved progress clear mat karo.

`index.html` kholo. Upar Study Material, My Study aur Smart Revision buttons hain. Offline Library Advanced > 3 > Offline Library mein hai. Purana page `backupindex.html` mein preserved hai. Hosted copy: https://laxtline.github.io/Code-Editor-Pro/index.html#study. Agar browser purani cached copy dikhaye, Online / Offline se available update apply karo; phir Ctrl+Shift+R karo.
