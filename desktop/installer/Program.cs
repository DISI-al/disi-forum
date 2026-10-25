using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace DisiInstaller
{
    internal static class Info
    {
        public const string ProductName = "@PRODUCT@";
        public const string Version = "@VERSION@";
        public const string AppExe = "@APPEXE@";
        public const string Publisher = "DISI";
        public const string AppId = "@APPID@";
        public const string Style = "@STYLE@"; // green = DISI 论坛, mono = INSIST
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            var testDir = Environment.GetEnvironmentVariable("DISI_TEST_INSTALL");
            if (!string.IsNullOrEmpty(testDir))
            {
                InstallerEngine.Install(testDir, (p, m) => { });
                Environment.Exit(0);
            }

            var silent = args.Any(a => a.Equals("/S", StringComparison.OrdinalIgnoreCase));
            var uninstall = args.Any(a => a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase));

            if (uninstall)
            {
                Uninstaller.Run(silent);
                return;
            }

            ApplicationConfiguration.Initialize();
            Application.Run(new InstallerForm());
        }
    }

    internal static class Shortcuts
    {
        public static void Create(string linkPath, string targetExe, string workDir, string description)
        {
            // 用 WScript.Shell 生成 .lnk：临时 vbs 走 cscript，避免 COM 动态调用在部分环境崩溃
            var baseDir = Directory.Exists(workDir) ? workDir : Path.GetTempPath();
            var vbs = Path.Combine(baseDir, "disi-lnk-" + Guid.NewGuid().ToString("N") + ".vbs");
            string Q(string s) => s.Replace("\"", "\"\"");
            var script =
                "Set s = CreateObject(\"WScript.Shell\")" + "\r\n" +
                "Set l = s.CreateShortcut(\"" + Q(linkPath) + "\")" + "\r\n" +
                "l.TargetPath = \"" + Q(targetExe) + "\"" + "\r\n" +
                "l.WorkingDirectory = \"" + Q(workDir) + "\"" + "\r\n" +
                "l.IconLocation = \"" + Q(targetExe) + "\"" + "\r\n" +
                "l.Description = \"" + Q(description) + "\"" + "\r\n" +
                "l.Save" + "\r\n";
            File.WriteAllText(vbs, script, System.Text.Encoding.Unicode);
            try
            {
                var psi = new ProcessStartInfo("cscript.exe", "//nologo \"" + vbs + "\"")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                using var proc = Process.Start(psi);
                proc?.WaitForExit(15000);
            }
            finally
            {
                try { File.Delete(vbs); } catch { }
            }
        }

        public static void Delete(string linkPath)
        {
            try { if (File.Exists(linkPath)) File.Delete(linkPath); } catch { }
        }
    }

    internal sealed class InstallerForm : Form
    {
        private readonly TextBox _pathBox = new TextBox();
        private readonly Button _browse = new Button();
        private readonly Button _install = new Button();
        private readonly Button _cancel = new Button();
        private readonly ProgressBar _progress = new ProgressBar();
        private readonly Label _status = new Label();
        private readonly CheckBox _launch = new CheckBox();
        private bool _busy;

        public InstallerForm()
        {
            Text = Info.ProductName + " 安装程序";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(520, 240);
            Font = new Font("Microsoft YaHei UI", 9F);
            try { Icon = LoadEmbeddedIcon(); } catch { }

            var title = new Label
            {
                Text = Info.ProductName + "  " + Info.Version,
                Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold),
                Location = new Point(20, 16),
                AutoSize = true
            };
            var subtitle = new Label
            {
                Text = "选择安装位置后点击「安装」，会创建桌面和开始菜单快捷方式。",
                Location = new Point(22, 52),
                Size = new Size(470, 20),
                ForeColor = Color.DimGray
            };

            var label = new Label { Text = "安装到：", Location = new Point(22, 88), AutoSize = true };
            _pathBox.Location = new Point(88, 84);
            _pathBox.Size = new Size(330, 24);
            _pathBox.Text = DefaultDir();

            _browse.Text = "浏览…";
            _browse.Location = new Point(426, 83);
            _browse.Size = new Size(72, 26);
            _browse.Click += (s, e) =>
            {
                using var dlg = new FolderBrowserDialog { SelectedPath = _pathBox.Text };
                if (dlg.ShowDialog(this) == DialogResult.OK) _pathBox.Text = dlg.SelectedPath;
            };

            _launch.Text = "安装完成后运行";
            _launch.Location = new Point(88, 118);
            _launch.Checked = true;
            _launch.AutoSize = true;

            _progress.Location = new Point(22, 148);
            _progress.Size = new Size(476, 18);

            _status.Location = new Point(22, 172);
            _status.Size = new Size(476, 20);
            _status.Text = "准备就绪";

            _install.Text = "安装";
            _install.Location = new Point(258, 200);
            _install.Size = new Size(110, 30);
            _install.Click += async (s, e) => await StartInstallAsync();

            _cancel.Text = "取消";
            _cancel.Location = new Point(388, 200);
            _cancel.Size = new Size(110, 30);
            _cancel.Click += (s, e) => Close();

            Controls.AddRange(new Control[] { title, subtitle, label, _pathBox, _browse, _launch, _progress, _status, _install, _cancel });
            ApplyTheme(title);
        }

        private void ApplyTheme(Label title)
        {
            var green = Info.Style == "green";
            var bg = ColorTranslator.FromHtml(green ? "#0d1117" : "#050505");
            var panel = ColorTranslator.FromHtml(green ? "#161b22" : "#101010");
            var text = ColorTranslator.FromHtml(green ? "#e6edf3" : "#ededed");
            var muted = ColorTranslator.FromHtml(green ? "#8b949e" : "#8a8a8a");
            var accent = ColorTranslator.FromHtml(green ? "#2ea043" : "#ededed");
            var accentText = green ? Color.White : Color.Black;

            BackColor = bg;
            ForeColor = text;
            title.ForeColor = accent;
            _status.ForeColor = muted;

            _pathBox.BackColor = panel;
            _pathBox.ForeColor = text;
            _pathBox.BorderStyle = BorderStyle.FixedSingle;

            foreach (var btn in new[] { _browse, _cancel })
            {
                btn.FlatStyle = FlatStyle.Flat;
                btn.BackColor = panel;
                btn.ForeColor = text;
                btn.FlatAppearance.BorderColor = ColorTranslator.FromHtml(green ? "#30363d" : "#2a2a2a");
            }

            _install.FlatStyle = FlatStyle.Flat;
            _install.BackColor = accent;
            _install.ForeColor = accentText;
            _install.FlatAppearance.BorderColor = accent;

            _launch.ForeColor = text;
            _progress.Style = ProgressBarStyle.Continuous;
            _progress.BackColor = panel;
        }

        private static string DefaultDir()
        {
            var local = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", Info.ProductName);
            return local;
        }

        private static Icon LoadEmbeddedIcon()
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("appicon.ico");
            return stream == null ? null : new Icon(stream);
        }

        private async Task StartInstallAsync()
        {
            if (_busy) return;
            var dir = _pathBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(dir)) { MessageBox.Show(this, "请先选择安装位置。"); return; }

            _busy = true;
            _install.Enabled = false;
            _browse.Enabled = false;
            _pathBox.Enabled = false;
            _cancel.Enabled = false;

            try
            {
                await Task.Run(() => InstallerEngine.Install(dir, (p, msg) => BeginInvoke(new Action(() =>
                {
                    _progress.Value = Math.Max(0, Math.Min(100, p));
                    _status.Text = msg;
                }))));

                _status.Text = "安装完成";
                _progress.Value = 100;

                if (_launch.Checked)
                {
                    try { Process.Start(new ProcessStartInfo(Path.Combine(dir, Info.AppExe)) { UseShellExecute = true }); } catch { }
                }
                MessageBox.Show(this, "安装完成，已创建桌面和开始菜单快捷方式。", "完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "安装失败：" + ex.Message, "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                _busy = false;
                _install.Enabled = true;
                _browse.Enabled = true;
                _pathBox.Enabled = true;
                _cancel.Enabled = true;
            }
        }
    }

    internal static class InstallerEngine
    {
        private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + Info.AppId;

        public static void Install(string dir, Action<int, string> report)
        {
            report(2, "准备目录…");
            Directory.CreateDirectory(dir);

            report(5, "解压程序文件…");
            var asm = Assembly.GetExecutingAssembly();
            using (var payload = asm.GetManifestResourceStream("payload.zip"))
            {
                if (payload == null) throw new InvalidOperationException("安装包损坏：缺少 payload");
                using var zip = new ZipArchive(payload, ZipArchiveMode.Read);
                var entries = zip.Entries.Where(e => !string.IsNullOrEmpty(e.Name)).ToList();
                var index = 0;
                foreach (var entry in entries)
                {
                    var target = Path.Combine(dir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    entry.ExtractToFile(target, true);
                    index++;
                    if (index % 20 == 0)
                    {
                        report(5 + (int)(80.0 * index / Math.Max(1, entries.Count)), "解压程序文件… " + index + "/" + entries.Count);
                    }
                }
            }

            report(88, "创建快捷方式…");
            var exePath = Path.Combine(dir, Info.AppExe);
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"Microsoft\Windows\Start Menu\Programs");
            Shortcuts.Create(Path.Combine(desktop, Info.ProductName + ".lnk"), exePath, dir, Info.ProductName);
            Shortcuts.Create(Path.Combine(startMenu, Info.ProductName + ".lnk"), exePath, dir, Info.ProductName);

            report(93, "写入卸载信息…");
            var uninstallExe = Path.Combine(dir, "uninstall.exe");
            var self = Process.GetCurrentProcess().MainModule!.FileName!;
            if (!string.Equals(self, uninstallExe, StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(self, uninstallExe, true);
            }

            try
            {
                using var key = Registry.CurrentUser.CreateSubKey(UninstallKey);
                if (key != null)
                {
                    key.SetValue("DisplayName", Info.ProductName);
                    key.SetValue("DisplayVersion", Info.Version);
                    key.SetValue("Publisher", Info.Publisher);
                    key.SetValue("InstallLocation", dir);
                    key.SetValue("DisplayIcon", exePath);
                    key.SetValue("UninstallString", "\"" + uninstallExe + "\" /uninstall");
                    key.SetValue("QuietUninstallString", "\"" + uninstallExe + "\" /uninstall /S");
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
            }
            catch (Exception ex)
            {
                // 个别受限环境不允许写注册表：不影响安装，只是「应用列表」里看不到
                try { File.AppendAllText(Path.Combine(dir, "install.log"), "registry: " + ex.Message + "\r\n"); } catch { }
            }

            report(100, "安装完成");
        }
    }

    internal static class Uninstaller
    {
        private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + Info.AppId;

        public static void Run(bool silent)
        {
            var dir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);

            if (!silent)
            {
                var answer = MessageBox.Show("确定要卸载 " + Info.ProductName + " 吗？", "卸载", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (answer != DialogResult.Yes) return;
            }

            try
            {
                var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                var startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"Microsoft\Windows\Start Menu\Programs");
                Shortcuts.Delete(Path.Combine(desktop, Info.ProductName + ".lnk"));
                Shortcuts.Delete(Path.Combine(startMenu, Info.ProductName + ".lnk"));
                Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
            }
            catch { }

            if (!silent)
            {
                MessageBox.Show("已移除快捷方式和应用列表项，接下来会删除程序文件。", "卸载", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            // 自身被占用，交给临时脚本延时删除
            try
            {
                var cmd = Path.Combine(Path.GetTempPath(), "disi-uninstall-" + Guid.NewGuid().ToString("N") + ".cmd");
                File.WriteAllText(cmd,
                    "@echo off\r\n" +
                    "timeout /t 2 /nobreak >nul\r\n" +
                    "rmdir /s /q \"" + dir + "\"\r\n" +
                    "del /f /q \"%~f0\"\r\n");
                Process.Start(new ProcessStartInfo("cmd.exe", "/c \"" + cmd + "\"")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                });
            }
            catch { }
        }
    }
}
