using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Pratice Code")]
[assembly: AssemblyDescription("Offline desktop study application")]
[assembly: AssemblyVersion("1.4.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.7.2")]
internal static class Launcher {
    internal static string Root=AppDomain.CurrentDomain.BaseDirectory;
    internal static int Port=8790;
    internal static string Url {get{return "http://127.0.0.1:"+Port;}}
    internal static int RunServer(string arguments) {
        string python=Path.Combine(Root,"runtime","python.exe");
        if(!File.Exists(python))throw new IOException("The bundled Python runtime is missing. Please reinstall Pratice Code.");
        var info=new ProcessStartInfo(python,"\""+Path.Combine(Root,"launch.py")+"\" --port "+Port+" "+arguments){WorkingDirectory=Root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        using(var process=Process.Start(info)) {
            string output=process.StandardOutput.ReadToEnd(),errors=process.StandardError.ReadToEnd();process.WaitForExit();
            if(process.ExitCode!=0)throw new IOException(output+Environment.NewLine+errors);
            return process.ExitCode;
        }
    }
    private static bool Running() {
        try {var request=(HttpWebRequest)WebRequest.Create(Url+"/api/health");request.Timeout=800;request.Proxy=null;
            string identity;using(var sha=SHA256.Create())identity=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(Root).TrimEnd('\\','/').ToLowerInvariant()))).Replace("-","").ToLowerInvariant();
            using(var response=request.GetResponse())using(var reader=new StreamReader(response.GetResponseStream())){string body=reader.ReadToEnd();return body.Contains("Pratice Code")&&body.Contains(identity);}
        } catch{return false;}
    }
    [STAThread] private static int Main(string[] args) {
        bool ownServer=false;
        try {
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            int portIndex=Array.IndexOf(args,"--port");
            if(portIndex>=0&&(portIndex+1>=args.Length||!int.TryParse(args[portIndex+1],out Port)||Port<1024||Port>65535))throw new ArgumentException("Choose a port from 1024 through 65535.");
            string config=Path.Combine(Root,"studio-private","desktop-port.txt");
            if(portIndex<0){int saved;if(File.Exists(config)&&int.TryParse(File.ReadAllText(config),out saved)&&saved>=1024&&saved<=65535)Port=saved;
                if(!Running()){bool found=false;for(int candidate=Port;candidate<Math.Min(Port+25,65536);candidate++){var listener=new System.Net.Sockets.TcpListener(IPAddress.Loopback,candidate);try{listener.Start();Port=candidate;found=true;break;}catch(System.Net.Sockets.SocketException){}finally{listener.Stop();}}if(!found)throw new IOException("Could not find an available local app port.");}
                Directory.CreateDirectory(Path.GetDirectoryName(config));File.WriteAllText(config,Port.ToString());}
            if(Array.IndexOf(args,"--stop")>=0)return RunServer("--stop");
            bool alreadyRunning=Running();RunServer("--no-browser");ownServer=!alreadyRunning;
            if(Array.IndexOf(args,"--no-browser")>=0){ownServer=false;return 0;}
            string engine=Path.Combine(Root,"desktop-runtime");
            if(!File.Exists(Path.Combine(engine,"msedgewebview2.exe")))throw new IOException("The offline desktop runtime is missing. Please reinstall the desktop edition.");
            using(var form=new DesktopWindow(Url+"/#home",null,true))Application.Run(form);
            return 0;
        } catch(Exception error) {MessageBox.Show(error.Message,"Pratice Code",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
        finally {if(ownServer)try{RunServer("--stop");}catch{}}
    }
}
internal sealed class DesktopWindow:Form {
    internal WebView2 View;
    CoreWebView2Environment environment;
    string initialUrl;bool main,allowClose,closing,initialized;
    Timer closeTimer;
    internal DesktopWindow(string url,CoreWebView2Environment shared,bool primary) {
        initialUrl=url;environment=shared;main=primary;Text="Pratice Code";AutoScaleDimensions=new SizeF(96,96);AutoScaleMode=AutoScaleMode.Dpi;Size=new Size(1340,900);MinimumSize=new Size(800,600);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(24,29,47);if(primary)WindowState=FormWindowState.Maximized;
        string icon=Path.Combine(Launcher.Root,"windows","PraticeCode.ico");if(File.Exists(icon))Icon=new Icon(icon);
        View=new WebView2{Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor};Controls.Add(View);
        if(primary)Shown+=async delegate{if(initialized)return;try{await Initialize();}catch(Exception error){MessageBox.Show(this,error.Message,"Could not open Pratice Code",MessageBoxButtons.OK,MessageBoxIcon.Error);allowClose=true;Close();}};
        FormClosing+=SaveBeforeClose;
    }
    internal async Task Initialize() {
        if(initialized)return;
        if(environment==null)environment=await CoreWebView2Environment.CreateAsync(Path.Combine(Launcher.Root,"desktop-runtime"),Path.Combine(Launcher.Root,"studio-private","desktop-profile"));
        await View.EnsureCoreWebView2Async(environment);initialized=true;
        View.CoreWebView2.Settings.AreDevToolsEnabled=false;
        View.CoreWebView2.Settings.IsStatusBarEnabled=false;
        View.CoreWebView2.Settings.IsZoomControlEnabled=true;
        View.CoreWebView2.NewWindowRequested+=async delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e) {
            var deferral=e.GetDeferral();e.Handled=true;
            try {var child=new DesktopWindow(e.Uri,environment,false);child.Show(this);await child.Initialize();e.NewWindow=child.View.CoreWebView2;}
            catch(Exception error){MessageBox.Show(this,error.Message,"Could not open this document");}
            finally{deferral.Complete();}
        };
        View.CoreWebView2.DownloadStarting+=delegate(object sender,CoreWebView2DownloadStartingEventArgs e) {
            using(var dialog=new SaveFileDialog{FileName=Path.GetFileName(e.ResultFilePath),Filter="All files|*.*",OverwritePrompt=true}) {
                if(dialog.ShowDialog(this)==DialogResult.OK){e.ResultFilePath=dialog.FileName;e.Handled=true;}else e.Cancel=true;
            }
        };
        View.CoreWebView2.WebMessageReceived+=delegate(object sender,CoreWebView2WebMessageReceivedEventArgs e) {
            if(!e.Source.StartsWith(Launcher.Url+"/",StringComparison.Ordinal))return;
            try{string message=e.TryGetWebMessageAsString();if(message=="pratice-close-ready"&&closing)FinishClose();else if(message=="pratice-save-error"&&closing)CancelClose();else if(message=="pratice-open-saves"){string folder=Path.Combine(Launcher.Root,"studio-private");Directory.CreateDirectory(folder);Process.Start(new ProcessStartInfo("explorer.exe","\""+folder+"\""){UseShellExecute=true});}}catch{}
        };
        View.CoreWebView2.NavigationCompleted+=delegate {Text=main?"Pratice Code":"Pratice Code · Document";};
        if(main){string backup=Path.Combine(Launcher.Root,"studio-private",".codelab-data","progress.json");if(File.Exists(backup)){string encoded=Convert.ToBase64String(File.ReadAllBytes(backup));await View.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("if(location.origin==='"+Launcher.Url+"'){try{if(!localStorage.getItem('cl_sync_device')){const backup=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('"+encoded+"'),c=>c.charCodeAt(0))));const clocks={};for(const [key,record] of Object.entries(backup.records||{})){if(key.startsWith('cl_')&&typeof record.value==='string'){localStorage.setItem(key,record.value);clocks[key]={updatedAt:record.updatedAt,device:record.device};}}localStorage.setItem('cl_sync_clock',JSON.stringify(clocks));}}catch{}}");}}
        View.CoreWebView2.Navigate(initialUrl);
    }
    private async void SaveBeforeClose(object sender,FormClosingEventArgs e) {
        if(!main||allowClose||View.CoreWebView2==null)return;
        e.Cancel=true;if(closing)return;closing=true;
        closeTimer=new Timer{Interval=15000};closeTimer.Tick+=delegate{CancelClose();};closeTimer.Start();
        try {await View.CoreWebView2.ExecuteScriptAsync("(async()=>{try{if(typeof Unified!=='undefined')Unified.saveDraft();if(typeof ClassicSave!=='undefined')ClassicSave.persist();if(typeof LearningTiming!=='undefined')LearningTiming.flush();if(typeof ProgressBackup!=='undefined')ProgressBackup.flush(false);if(typeof SaveBridge!=='undefined')await SaveBridge.flush();chrome.webview.postMessage('pratice-close-ready');}catch(error){chrome.webview.postMessage('pratice-save-error');}})()");}
        catch{CancelClose();}
    }
    private void FinishClose(){if(allowClose)return;allowClose=true;if(closeTimer!=null){closeTimer.Stop();closeTimer.Dispose();}Close();}
    private void CancelClose(){if(closeTimer!=null){closeTimer.Stop();closeTimer.Dispose();}closing=false;MessageBox.Show(this,"Your app copy is saved, but the folder save has not finished. Check Saving status and retry closing after the folder backup completes.","Finish saving your work",MessageBoxButtons.OK,MessageBoxIcon.Information);}
}
