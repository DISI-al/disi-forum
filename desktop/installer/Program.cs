using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
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

    internal static class Theme
    {
        public static bool Green => Info.Style == "green";
        public static Color Bg => ColorTranslator.FromHtml(Green ? "#0d1117" : "#080808");
        public static Color Panel => ColorTranslator.FromHtml(Green ? "#161b22" : "#101010");
        public static Color Border => ColorTranslator.FromHtml(Green ? "#30363d" : "#262626");
        public static Color Text => ColorTranslator.FromHtml(Green ? "#e6edf3" : "#ededed");
        public static Color Muted => ColorTranslator.FromHtml(Green ? "#8b949e" : "#8a8a8a");
        public static Color Accent => ColorTranslator.FromHtml(Green ? "#2ea043" : "#ededed");
        public static Color AccentText => Green ? Color.White : Color.Black;
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                Run(args);
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(Path.Combine(AppContext.BaseDirectory, "setup-error.log"), DateTime.Now.ToString("s") + " " + ex + "\r\n");
                }
                catch { }
                try
                {
                    MessageBox.Show("安装程序启动失败：\n" + ex.Message, "DISI Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                catch { }
            }
        }

        private static void Run(string[] args)
        {
            var testDir = Environment.GetEnvironmentVariable("DISI_TEST_INSTALL");
            if (!string.IsNullOrEmpty(testDir))
            {
                InstallerEngine.Install(testDir, (p, m) => { });
                Environment.Exit(0);
            }

            var silent = args.Any(a => a.Equals("/S", StringComparison.OrdinalIgnoreCase));
            if (args.Any(a => a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase)))
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
        [System.Runtime.InteropServices.ComImport]
        [System.Runtime.InteropServices.Guid("000214F9-0000-0000-C000-000000000046")]
        [System.Runtime.InteropServices.InterfaceType(System.Runtime.InteropServices.ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellLinkW
        {
            void GetPath(System.Text.StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription(System.Text.StringBuilder pszName, int cch);
            void SetDescription(string pszName);
            void GetWorkingDirectory(System.Text.StringBuilder pszDir, int cch);
            void SetWorkingDirectory(string pszDir);
            void GetArguments(System.Text.StringBuilder pszArgs, int cch);
            void SetArguments(string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation(System.Text.StringBuilder pszIconPath, int cch, out int piIcon);
            void SetIconLocation(string pszIconPath, int iIcon);
            void SetRelativePath(string pszPathRel, uint dwReserved);
            void Resolve(IntPtr hwnd, uint fFlags);
            void SetPath(string pszFile);
        }

        [System.Runtime.InteropServices.ComImport]
        [System.Runtime.InteropServices.Guid("0000010b-0000-0000-C000-000000000046")]
        [System.Runtime.InteropServices.InterfaceType(System.Runtime.InteropServices.ComInterfaceType.InterfaceIsIUnknown)]
        private interface IPersistFile
        {
            void GetClassID(out Guid pClassID);
            void IsDirty();
            void Load(string pszFileName, uint dwMode);
            void Save(string pszFileName, bool fRemember);
            void SaveCompleted(string pszFileName);
            void GetCurFile(out string ppszFileName);
        }

        [System.Runtime.InteropServices.DllImport("shell32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
        private static extern int CoCreateInstance(
            ref Guid rclsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid riid, out IntPtr ppv);

        private static readonly Guid CLSID_ShellLink = new Guid("00021401-0000-0000-C000-000000000046");

        /// <summary>进程内直接写 .lnk，失败时回落到 cscript。</summary>
        public static void Create(string linkPath, string targetExe, string workDir, string description, string? iconPath = null)
        {
            try
            {
                var iidShellLink = new Guid("000214F9-0000-0000-C000-000000000046");
                var iidPersist = new Guid("0000010b-0000-0000-C000-000000000046");
                var clsid = CLSID_ShellLink;
                var hr = CoCreateInstance(ref clsid, IntPtr.Zero, 1, ref iidShellLink, out var linkPtr);
                if (hr == 0 && linkPtr != IntPtr.Zero)
                {
                    var link = (IShellLinkW)System.Runtime.InteropServices.Marshal.GetObjectForIUnknown(linkPtr);
                    link.SetPath(targetExe);
                    link.SetWorkingDirectory(workDir);
                    link.SetDescription(description);
                    link.SetIconLocation(iconPath ?? targetExe, 0);
                    var persist = (IPersistFile)link;
                    persist.Save(linkPath, true);
                    System.Runtime.InteropServices.Marshal.Release(linkPtr);
                }
            }
            catch
            {
                // 落到 cscript
            }

            if (File.Exists(linkPath)) return;
            CreateWithCscript(linkPath, targetExe, workDir, description, iconPath);
        }

        private static void CreateWithCscript(string linkPath, string targetExe, string workDir, string description, string? iconPath)
        {
            var baseDir = Directory.Exists(workDir) ? workDir : Path.GetTempPath();
            var vbs = Path.Combine(baseDir, "mklnk-" + Guid.NewGuid().ToString("N") + ".vbs");
            static string Q(string s) => s.Replace("\"", "\"\"");
            var script =
                "Set s = CreateObject(\"WScript.Shell\")\r\n" +
                "Set l = s.CreateShortcut(\"" + Q(linkPath) + "\")\r\n" +
                "l.TargetPath = \"" + Q(targetExe) + "\"\r\n" +
                "l.WorkingDirectory = \"" + Q(workDir) + "\"\r\n" +
                "l.IconLocation = \"" + Q(iconPath ?? targetExe) + ",0\"\r\n" +
                "l.Description = \"" + Q(description) + "\"\r\n" +
                "l.Save\r\n";
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
        private readonly Panel _progressTrack = new Panel();
        private readonly Panel _progressFill = new Panel();
        private readonly Label _status = new Label();
        private readonly CheckBox _launch = new CheckBox();
        private readonly Label _title = new Label();
        private readonly Button _close = new Button();
        private bool _busy;
        private Point _dragOffset;

        public InstallerForm()
        {
            SuspendLayout();

            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(640, 420);
            BackColor = Theme.Bg;
            DoubleBuffered = true;
            Font = new Font("Microsoft YaHei UI", 9.5F);
            try { Icon = LoadIcon(); } catch { }

            var logo = new PictureBox
            {
                Location = new Point(32, 30),
                Size = new Size(44, 44),
                SizeMode = PictureBoxSizeMode.StretchImage
            };
            try
            {
                var ico = LoadIcon();
                if (ico != null) logo.Image = ico.ToBitmap();
            }
            catch { }

            _title.Text = Info.ProductName;
            _title.Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold);
            _title.ForeColor = Theme.Text;
            _title.Location = new Point(88, 30);
            _title.AutoSize = true;



            _close.Text = "✕";
            _close.FlatStyle = FlatStyle.Flat;
            _close.FlatAppearance.BorderSize = 0;
            _close.Size = new Size(36, 28);
            _close.Location = new Point(ClientSize.Width - 68, 12);
            _close.ForeColor = Theme.Muted;
            _close.BackColor = Theme.Bg;
            _close.TabStop = false;
            _close.Click += (s, e) => { if (!_busy) Close(); };

            var line = new Panel { BackColor = Theme.Border, Location = new Point(32, 92), Size = new Size(ClientSize.Width - 64, 1) };

            var pathLabel = new Label { Text = "安装位置", ForeColor = Theme.Muted, Location = new Point(32, 112), AutoSize = true };

            _pathBox.Location = new Point(32, 136);
            _pathBox.AutoSize = false;
            _pathBox.BorderStyle = BorderStyle.FixedSingle;
            _pathBox.BackColor = Theme.Panel;
            _pathBox.ForeColor = Theme.Text;
            _pathBox.Text = DefaultDir();

            _browse.Text = "浏览";
            _browse.Location = new Point(508, 136);
            _browse.Size = new Size(100, 34);
            StyleSecondary(_browse);
            _browse.Click += (s, e) =>
            {
                using var dlg = new FolderBrowserDialog { SelectedPath = _pathBox.Text };
                if (dlg.ShowDialog(this) == DialogResult.OK) _pathBox.Text = dlg.SelectedPath;
            };

            _progressTrack.Location = new Point(32, 200);
            _progressTrack.Size = new Size(ClientSize.Width - 64, 6);
            _progressTrack.BackColor = Theme.Panel;
            _progressFill.Location = new Point(0, 0);
            _progressFill.Size = new Size(0, 6);
            _progressFill.BackColor = Theme.Accent;
            _progressTrack.Controls.Add(_progressFill);

            _status.Text = "准备就绪";
            _status.ForeColor = Theme.Muted;
            _status.Location = new Point(32, 214);
            _status.Size = new Size(400, 22);

            _launch.Text = "安装完成后运行";
            _launch.ForeColor = Theme.Text;
            _launch.BackColor = Theme.Bg;
            _launch.Location = new Point(32, 256);
            _launch.AutoSize = true;
            _launch.Checked = true;

            _cancel.Text = "取消";
            _cancel.Size = new Size(120, 40);
            _cancel.Location = new Point(ClientSize.Width - 152, 348);
            StyleSecondary(_cancel);
            _cancel.Click += (s, e) => { if (!_busy) Close(); };

            _install.Text = "安装";
            _install.Size = new Size(120, 40);
            _install.Location = new Point(ClientSize.Width - 284, 348);
            _install.FlatStyle = FlatStyle.Flat;
            _install.FlatAppearance.BorderSize = 0;
            _install.BackColor = Theme.Accent;
            _install.ForeColor = Theme.AccentText;
            _install.Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold);
            _install.Click += async (s, e) => await StartInstallAsync();

            Controls.AddRange(new Control[]
            {
                logo, _title, _close, line, pathLabel, _pathBox, _browse,
                _progressTrack, _status, _launch, _install, _cancel
            });

            MouseDown += (s, e) => { _dragOffset = e.Location; };
            MouseMove += (s, e) => { if (e.Button == MouseButtons.Left) Location = new Point(Location.X + e.X - _dragOffset.X, Location.Y + e.Y - _dragOffset.Y); };
            _title.MouseDown += (s, e) => { _dragOffset = PointToClient(Cursor.Position); };
            _title.MouseMove += (s, e) => { if (e.Button == MouseButtons.Left) Location = new Point(Cursor.Position.X - _dragOffset.X, Cursor.Position.Y - _dragOffset.Y); };

            ResumeLayout();
        }

        private static void StyleSecondary(Button b)
        {
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderColor = Theme.Border;
            b.FlatAppearance.BorderSize = 1;
            b.BackColor = Theme.Panel;
            b.ForeColor = Theme.Text;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using var pen = new Pen(Theme.Border);
            e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
        }

        private static string DefaultDir()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", Info.ProductName);
        }

        private static Icon? LoadIcon()
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("appicon.ico");
            return stream == null ? null : new Icon(stream, 64, 64);
        }

        private void SetProgress(int percent, string message)
        {
            var p = Math.Max(0, Math.Min(100, percent));
            _progressFill.Width = (int)(_progressTrack.Width * p / 100.0);
            _status.Text = message;
        }

        private async Task StartInstallAsync()
        {
            if (_busy) return;
            var dir = _pathBox.Text.Trim();
            if (string.IsNullOrWhiteSpace(dir))
            {
                MessageBox.Show(this, "请先选择安装位置。");
                return;
            }

            _busy = true;
            _install.Enabled = false;
            _browse.Enabled = false;
            _pathBox.Enabled = false;
            _cancel.Enabled = false;
            _launch.Enabled = false;

            try
            {
                await Task.Run(() => InstallerEngine.Install(dir, (p, msg) => BeginInvoke(new Action(() => SetProgress(p, msg)))));
                SetProgress(100, "安装完成");

                if (_launch.Checked)
                {
                    try { Process.Start(new ProcessStartInfo(Path.Combine(dir, Info.AppExe)) { UseShellExecute = true }); } catch { }
                }

                await Task.Delay(350);
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
                _launch.Enabled = true;
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
                for (var i = 0; i < entries.Count; i++)
                {
                    var entry = entries[i];
                    var target = Path.Combine(dir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    entry.ExtractToFile(target, true);
                    if (i % 25 == 0 || i == entries.Count - 1)
                    {
                        report(5 + (int)(80.0 * i / Math.Max(1, entries.Count)), "解压程序文件… " + (i + 1) + "/" + entries.Count);
                    }
                }
            }

            // 统一图标文件：快捷方式和应用列表都指向它，避免 exe 图标被替换后显示异常
            var iconPath = Path.Combine(dir, "app.ico");
            try
            {
                using var iconStream = asm.GetManifestResourceStream("appicon.ico");
                if (iconStream != null)
                {
                    using var fs = File.Create(iconPath);
                    iconStream.CopyTo(fs);
                }
            }
            catch { }

            report(88, "创建快捷方式…");
            var exePath = Path.Combine(dir, Info.AppExe);
            var iconForShortcut = File.Exists(iconPath) ? iconPath : exePath;
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var userPrograms = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            try { Shortcuts.Create(Path.Combine(desktop, Info.ProductName + ".lnk"), exePath, dir, Info.ProductName, iconForShortcut); }
            catch (Exception ex) { try { File.AppendAllText(Path.Combine(dir, "install.log"), "desktop-shortcut: " + ex.Message + "\r\n"); } catch { } }
            try { Shortcuts.Create(Path.Combine(userPrograms, Info.ProductName + ".lnk"), exePath, dir, Info.ProductName, iconForShortcut); }
            catch (Exception ex) { try { File.AppendAllText(Path.Combine(dir, "install.log"), "startmenu-shortcut: " + ex.Message + "\r\n"); } catch { } }
            // 再放一个英文名别名，方便开始菜单用英文搜索
            var alias = Info.Style == "green" ? "DISI Forum" : "INSIST App";
            try { Shortcuts.Create(Path.Combine(userPrograms, alias + ".lnk"), exePath, dir, Info.ProductName); } catch { }

            // 有权限时再写一份到「所有用户」开始菜单，方便开始菜单搜索到
            try
            {
                var commonPrograms = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
                if (!string.IsNullOrEmpty(commonPrograms) && Directory.Exists(commonPrograms))
                {
                    Shortcuts.Create(Path.Combine(commonPrograms, Info.ProductName + ".lnk"), exePath, dir, Info.ProductName, iconForShortcut);
                }
            }
            catch { }

            report(93, "写入卸载信息…");

            // 卸载器：用脚本实现，避免复制 exe 失败导致卸载入口失效
            var uninstallPs1 = Path.Combine(dir, "uninstall.ps1");
            var ps1 = string.Join("\r\n", new[]
            {
                "$ErrorActionPreference = 'SilentlyContinue'",
                "$dir = '" + dir.Replace("'", "''") + "'",
                "$name = '" + Info.ProductName.Replace("'", "''") + "'",
                "$alias = '" + (Info.Style == "green" ? "DISI Forum" : "INSIST App") + "'",
                "$key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + Info.AppId + "'",
                "Get-Process | Where-Object { $_.Path -like \"$dir\\*\" } | Stop-Process -Force",
                "foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('CommonPrograms'))) {",
                "  foreach ($n in @($name, $alias)) { Remove-Item (Join-Path $d ($n + '.lnk')) -Force }",
                "}",
                "Remove-Item $key -Recurse -Force",
                "$cmd = Join-Path $env:TEMP ('disi-clean-' + [guid]::NewGuid().ToString('N') + '.cmd')",
                "Set-Content -Path $cmd -Encoding ASCII -Value ('@echo off' + [Environment]::NewLine + 'timeout /t 2 /nobreak >nul' + [Environment]::NewLine + 'rmdir /s /q \"' + $dir + '\"' + [Environment]::NewLine + 'del /f /q \"%~f0\"')",
                "Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c \"' + $cmd + '\"') -WindowStyle Hidden",
                "",
            });
            File.WriteAllText(uninstallPs1, ps1, new System.Text.UTF8Encoding(true));

            var uninstallExe = Path.Combine(dir, "uninstall.exe");
            var self = Process.GetCurrentProcess().MainModule?.FileName;
            if (!string.IsNullOrEmpty(self) && !string.Equals(self, uninstallExe, StringComparison.OrdinalIgnoreCase))
            {
                try { File.Copy(self, uninstallExe, true); } catch { }
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
                    key.SetValue("DisplayIcon", iconForShortcut);
                    key.SetValue("UninstallString", File.Exists(uninstallExe) ? ("\"" + uninstallExe + "\" /uninstall") : ("powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + uninstallPs1 + "\""));
                    key.SetValue("QuietUninstallString", File.Exists(uninstallExe) ? ("\"" + uninstallExe + "\" /uninstall /S") : ("powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + uninstallPs1 + "\""));
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
            }
            catch (Exception ex)
            {
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
                var userPrograms = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                var commonPrograms = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
                Shortcuts.Delete(Path.Combine(desktop, Info.ProductName + ".lnk"));
                Shortcuts.Delete(Path.Combine(userPrograms, Info.ProductName + ".lnk"));
                if (!string.IsNullOrEmpty(commonPrograms)) Shortcuts.Delete(Path.Combine(commonPrograms, Info.ProductName + ".lnk"));
                Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
            }
            catch { }

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
