using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Windows.Forms;

[assembly: AssemblyTitle("Pratice Code Setup")]
[assembly: AssemblyDescription("Self-contained offline study website installer")]
[assembly: AssemblyVersion("1.4.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.7.2")]
internal static class Setup {
    [STAThread] private static int Main(string[] args) {
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        try {
            if(Array.IndexOf(args,"--silent")>=0) {
                int target=Array.IndexOf(args,"--target");
                if(target<0||target+1>=args.Length)throw new ArgumentException("Silent mode requires --target followed by a folder.");
                Install(args[target+1],delegate(int p){});return 0;
            }
            Application.Run(new SetupForm());return 0;
        } catch(Exception error) {
            if(Array.IndexOf(args,"--silent")<0)MessageBox.Show(error.Message,"Pratice Code Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);
            return 1;
        }
    }
    internal static void Install(string folder,Action<int> progress) {
        string root=Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        if(root==Path.GetPathRoot(root))throw new IOException("Choose a dedicated application folder.");
        Directory.CreateDirectory(root);
        using(Stream payload=Assembly.GetExecutingAssembly().GetManifestResourceStream("PraticeCode.Payload")) {
            if(payload==null)throw new IOException("Installation content is missing.");
            using(var zip=new ZipArchive(payload,ZipArchiveMode.Read)) {
                int count=0;
                foreach(var entry in zip.Entries) {
                    const string prefix="Pratice-Code-Offline/";
                    if(!entry.FullName.StartsWith(prefix,StringComparison.Ordinal))throw new IOException("Unexpected installation path.");
                    string relative=entry.FullName.Substring(prefix.Length).Replace('/',Path.DirectorySeparatorChar);
                    if(relative.Length==0)continue;
                    string destination=Path.GetFullPath(Path.Combine(root,relative));
                    if(!destination.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid installation path.");
                    if(entry.Name.Length==0){Directory.CreateDirectory(destination);continue;}
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    using(var input=entry.Open())using(var output=new FileStream(destination,FileMode.Create,FileAccess.Write,FileShare.None))input.CopyTo(output);
                    count++;if(count%100==0)progress((int)(100L*count/zip.Entries.Count));
                }
            }
        }
        if(!File.Exists(Path.Combine(root,"Pratice Code.exe"))||!File.Exists(Path.Combine(root,"runtime","python.exe"))||!File.Exists(Path.Combine(root,"desktop-runtime","msedgewebview2.exe")))throw new IOException("Installation did not finish. Please try again.");
        string engine=Path.Combine(root,"desktop-runtime");
        var permissions=Directory.GetAccessControl(engine);
        foreach(string sid in new[]{"S-1-15-2-1","S-1-15-2-2"})permissions.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid),FileSystemRights.ReadAndExecute,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
        Directory.SetAccessControl(engine,permissions);
        progress(100);
    }
    internal static void Shortcut(string path,string folder,string arguments) {
        Type shellType=Type.GetTypeFromProgID("WScript.Shell");
        object shell=Activator.CreateInstance(shellType);
        object link=shellType.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});
        Type t=link.GetType();
        t.InvokeMember("TargetPath",BindingFlags.SetProperty,null,link,new object[]{Path.Combine(folder,"Pratice Code.exe")});
        t.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,link,new object[]{folder});
        t.InvokeMember("Arguments",BindingFlags.SetProperty,null,link,new object[]{arguments});
        t.InvokeMember("Description",BindingFlags.SetProperty,null,link,new object[]{"Pratice Code offline study workspace"});
        t.InvokeMember("Save",BindingFlags.InvokeMethod,null,link,null);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
    }
}
internal sealed class SetupForm:Form {
    TextBox folder;Button browse,install;CheckBox shortcut,open;ProgressBar bar;Label status;bool busy;
    internal SetupForm() {
        Text="Pratice Code Setup";ClientSize=new Size(610,395);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(24,29,47);ForeColor=Color.White;Font=new Font("Segoe UI",10);
        Controls.Add(new Label{Text="Pratice Code",Font=new Font("Segoe UI",24,FontStyle.Bold),ForeColor=Color.FromArgb(255,161,22),Location=new Point(28,22),Size=new Size(550,45)});
        Controls.Add(new Label{Text="Your complete offline desktop study app",Location=new Point(30,76),Size=new Size(550,26)});
        Controls.Add(new Label{Text="Python, JavaScript, TypeScript and SQL work offline.\nOther compiler languages use internet or installed local tools.",ForeColor=Color.LightGray,Location=new Point(30,110),Size=new Size(550,48)});
        Controls.Add(new Label{Text="Install folder",Location=new Point(30,174),Size=new Size(500,22)});
        folder=new TextBox{Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PraticeCode"),Location=new Point(30,199),Size=new Size(444,26)};Controls.Add(folder);
        browse=new Button{Text="Browse...",Location=new Point(482,197),Size=new Size(98,30)};browse.Click+=delegate{using(var dialog=new FolderBrowserDialog()){dialog.Description="Choose a dedicated folder for Pratice Code";dialog.SelectedPath=folder.Text;if(dialog.ShowDialog(this)==DialogResult.OK)folder.Text=dialog.SelectedPath;}};Controls.Add(browse);
        shortcut=new CheckBox{Text="Create Desktop and Start menu shortcuts",Checked=true,Location=new Point(30,241),Size=new Size(550,25)};Controls.Add(shortcut);
        open=new CheckBox{Text="Open Pratice Code after installation",Checked=true,Location=new Point(30,269),Size=new Size(550,25)};Controls.Add(open);
        bar=new ProgressBar{Location=new Point(30,311),Size=new Size(550,8)};Controls.Add(bar);
        status=new Label{Text="Installs for your account. No internet or administrator access required.",ForeColor=Color.LightGray,Location=new Point(30,329),Size=new Size(420,45),Font=new Font("Segoe UI",9)};Controls.Add(status);
        install=new Button{Text="Install",Location=new Point(470,340),Size=new Size(110,34),BackColor=Color.FromArgb(255,161,22),ForeColor=Color.Black,FlatStyle=FlatStyle.Flat};install.Click+=InstallClick;Controls.Add(install);
        FormClosing+=delegate(object sender,FormClosingEventArgs e){if(busy)e.Cancel=true;};
    }
    private void InstallClick(object sender,EventArgs e) {
        if(install.Text=="Finish"){Close();return;}
        string destination;
        try{destination=Path.GetFullPath(folder.Text);}catch{MessageBox.Show(this,"Choose a valid installation folder.");return;}
        bool createShortcuts=shortcut.Checked,launch=open.Checked;
        busy=true;install.Enabled=browse.Enabled=folder.Enabled=shortcut.Enabled=open.Enabled=false;status.Text="Installing your offline workspace...";
        var worker=new BackgroundWorker{WorkerReportsProgress=true};
        worker.DoWork+=delegate {Setup.Install(destination,p=>worker.ReportProgress(p));};
        worker.ProgressChanged+=delegate(object s,ProgressChangedEventArgs ev){bar.Value=Math.Min(100,ev.ProgressPercentage);status.Text="Installing offline content... "+bar.Value+"%";};
        worker.RunWorkerCompleted+=delegate(object s,RunWorkerCompletedEventArgs ev) {
            busy=false;install.Enabled=true;
            if(ev.Error!=null){status.Text="Installation stopped. Close any running installed copy and try again.";MessageBox.Show(this,ev.Error.Message,"Installation stopped",MessageBoxButtons.OK,MessageBoxIcon.Error);browse.Enabled=folder.Enabled=shortcut.Enabled=open.Enabled=true;return;}
            string shortcutNote="";
            if(createShortcuts)try{
                Setup.Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"Pratice Code.lnk"),destination,"");
                string menu=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"Pratice Code");Directory.CreateDirectory(menu);
                Setup.Shortcut(Path.Combine(menu,"Pratice Code.lnk"),destination,"");Setup.Shortcut(Path.Combine(menu,"Stop Pratice Code.lnk"),destination,"--stop");
            }catch{shortcutNote=" Open Pratice Code.exe in your install folder; shortcuts could not be created.";}
            status.Text="Ready! Your study workspace works offline."+shortcutNote;bar.Value=100;install.Text="Finish";
            if(launch)Process.Start(new ProcessStartInfo(Path.Combine(destination,"Pratice Code.exe")){WorkingDirectory=destination,UseShellExecute=true});
        };
        worker.RunWorkerAsync();
    }
}
