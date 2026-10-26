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
        public const string Style = "@STYLE@";
        public static string DisplayName => ProductName.Replace('_', ' ');
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
                try { File.AppendAllText(Path.Combine(AppContext.BaseDirectory, "setup-error.log"), DateTime.Now.ToString("s") + " " + ex + "\r\n"); } catch { }
                try { MessageBox.Show("安装程序启动失败：\n" + ex.Message, "DISI Setup", MessageBoxButtons.OK, MessageBoxIcon.Error); } catch { }
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

            // 调试用：把界面渲染成 PNG（DISI_RENDER_UI=<output.png>）
            var renderTo = Environment.GetEnvironmentVariable("DISI_RENDER_UI");
            if (!string.IsNullOrEmpty(renderTo))
            {
                var f = new InstallerForm();
                f.Show();
                Application.DoEvents();
                System.Threading.Thread.Sleep(400);
                Application.DoEvents();
                using var bmp = new Bitmap(f.Width, f.Height);
                f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
                bmp.Save(renderTo, System.Drawing.Imaging.ImageFormat.Png);
                f.Close();
                return;
            }

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
        private static extern int CoCreateInstance(ref Guid rclsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid riid, out IntPtr ppv);

        private static readonly Guid CLSID_ShellLink = new Guid("00021401-0000-0000-C000-000000000046");

        public static void Create(string linkPath, string targetExe, string workDir, string description, string? iconPath = null)
        {
            try
            {
                var iidShellLink = new Guid("000214F9-0000-0000-C000-000000000046");
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
                // 回落到 cscript
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
        private bool _busy;

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        private const int WM_NCLBUTTONDOWN = 0x00A1;
        private const int HTCAPTION = 2;

        private void BeginDrag(object? sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            ReleaseCapture();
            SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
        }

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

            const int left = 32;
            const int right = 32;
            var contentWidth = ClientSize.Width - left - right;

            // 标题区
            var logo = new PictureBox
            {
                Location = new Point(left, 32),
                Size = new Size(42, 42),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Theme.Bg
            };
            try
            {
                var bmp = LoadLogo();
                if (bmp != null) logo.Image = bmp;
            }
            catch { }

            var title = new Label
            {
                Text = Info.DisplayName,
                Font = new Font("Microsoft YaHei UI", 16.5F, FontStyle.Bold),
                ForeColor = Theme.Text,
                AutoSize = true,
                Location = new Point(left + 54, 32),
                BackColor = Theme.Bg
            };

            title.Top = logo.Top + (logo.Height - title.PreferredHeight) / 2;

            var close = new Button
            {
                Text = "✕",
                FlatStyle = FlatStyle.Flat,
                Size = new Size(40, 30),
                Location = new Point(ClientSize.Width - 52, 10),
                ForeColor = Theme.Muted,
                BackColor = Theme.Bg,
                TabStop = false
            };
            close.FlatAppearance.BorderSize = 0;
            close.Click += (s, e) => { if (!_busy) Close(); };

            // 安装位置
            var pathLabel = new Label
            {
                Text = "安装位置",
                ForeColor = Theme.Muted,
                AutoSize = true,
                Location = new Point(left, 108),
                BackColor = Theme.Bg
            };

            const int rowTop = 132;
            const int rowHeight = 44;

            var inputShell = new Panel
            {
                Location = new Point(left, rowTop),
                Size = new Size(contentWidth - 108 - 8, rowHeight),
                BackColor = Theme.Panel
            };
            inputShell.Paint += (s2, e2) =>
            {
                using var pen = new Pen(Theme.Border);
                e2.Graphics.DrawRectangle(pen, 0, 0, inputShell.Width - 1, inputShell.Height - 1);
            };

            _pathBox.BorderStyle = BorderStyle.None;
            _pathBox.BackColor = Theme.Panel;
            _pathBox.ForeColor = Theme.Text;
            _pathBox.Font = new Font("Microsoft YaHei UI", 11F);
            _pathBox.Text = DefaultDir();
            _pathBox.Location = new Point(12, 11);
            _pathBox.Width = inputShell.Width - 24;
            inputShell.Controls.Add(_pathBox);

            _browse.Text = "浏览";
            _browse.Location = new Point(left + contentWidth - 108, rowTop);
            _browse.Size = new Size(108, rowHeight);
            StyleSecondary(_browse);
            _browse.Click += (s, e) =>
            {
                using var dlg = new FolderBrowserDialog { SelectedPath = _pathBox.Text };
                if (dlg.ShowDialog(this) == DialogResult.OK) _pathBox.Text = dlg.SelectedPath;
            };

            // 进度
            _progressTrack.Location = new Point(left, rowTop + rowHeight + 26);
            _progressTrack.Size = new Size(contentWidth, 6);
            _progressTrack.BackColor = Theme.Panel;
            _progressFill.Location = new Point(0, 0);
            _progressFill.Size = new Size(0, 6);
            _progressFill.BackColor = Theme.Accent;
            _progressTrack.Controls.Add(_progressFill);

            _status.Text = "准备就绪";
            _status.ForeColor = Theme.Muted;
            _status.AutoSize = true;
            _status.Location = new Point(left, rowTop + rowHeight + 38);
            _status.BackColor = Theme.Bg;

            _launch.Text = "安装完成后运行";
            _launch.ForeColor = Theme.Text;
            _launch.BackColor = Theme.Bg;
            _launch.AutoSize = false;
            _launch.Size = new Size(200, 24);
            _launch.Location = new Point(left, rowTop + rowHeight + 84);
            _launch.Checked = true;

            // 按钮
            const int buttonTop = 348;
            _cancel.Text = "取消";
            _cancel.Size = new Size(108, 40);
            _cancel.Location = new Point(left + contentWidth - 108, buttonTop);
            StyleSecondary(_cancel);
            _cancel.Click += (s, e) => { if (!_busy) Close(); };

            _install.Text = "安装";
            _install.Size = new Size(108, 40);
            _install.Location = new Point(left + contentWidth - 108 - 12 - 108, buttonTop);
            _install.FlatStyle = FlatStyle.Flat;
            _install.FlatAppearance.BorderSize = 1;
            _install.FlatAppearance.BorderColor = Theme.Accent;
            _install.BackColor = Theme.Accent;
            _install.ForeColor = Theme.AccentText;
            _install.Font = new Font("Microsoft YaHei UI", 9.5F, FontStyle.Bold);
            _install.Click += async (s, e) => await StartInstallAsync();

            Controls.AddRange(new Control[]
            {
                logo, title, close, pathLabel, inputShell, _browse,
                _progressTrack, _status, _launch, _install, _cancel
            });

            // 拖动：标题区、logo、空白处
            MouseDown += BeginDrag;
            logo.MouseDown += BeginDrag;
            title.MouseDown += BeginDrag;
            pathLabel.MouseDown += BeginDrag;

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

        private static Bitmap? LoadLogo()
        {
            try
            {
                using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("appicon.ico");
                if (stream == null) return null;
                using var ico = new Icon(stream, 256, 256);
                using var raw = ico.ToBitmap();
                var minX = raw.Width;
                var minY = raw.Height;
                var maxX = -1;
                var maxY = -1;
                for (var y = 0; y < raw.Height; y++)
                {
                    for (var x = 0; x < raw.Width; x++)
                    {
                        if (raw.GetPixel(x, y).A > 12)
                        {
                            if (x < minX) minX = x;
                            if (y < minY) minY = y;
                            if (x > maxX) maxX = x;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                if (maxX <= minX || maxY <= minY) return raw;
                var rect = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
                return raw.Clone(rect, raw.PixelFormat);
            }
            catch
            {
                return null;
            }
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
                    var exePath = Path.Combine(dir, Info.AppExe);
                    InstallerEngine.KillRunning(Path.GetFileNameWithoutExtension(Info.AppExe));
                    await Task.Delay(400);
                    try
                    {
                        if (File.Exists(exePath))
                        {
                            Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true, WorkingDirectory = dir });
                        }
                        else
                        {
                            MessageBox.Show(this, "程序文件缺失，未找到：" + Environment.NewLine + exePath, "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show(this, "启动失败：" + ex.Message, "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }

                await Task.Delay(700);
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

        public static void KillRunning(string processName)
        {
            try
            {
                foreach (var proc in Process.GetProcessesByName(processName))
                {
                    try
                    {
                        proc.Kill(true);
                        proc.WaitForExit(2000);
                    }
                    catch { }
                }
            }
            catch { }
        }

        public static void Install(string dir, Action<int, string> report)
        {
            report(2, "准备目录…");
            KillRunning(Path.GetFileNameWithoutExtension(Info.AppExe));
            Directory.CreateDirectory(dir);
            try
            {
                var stale = Path.Combine(dir, "uninstalling.flag");
                if (File.Exists(stale)) File.Delete(stale);
            }
            catch { }

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
            var commonPrograms = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);

            foreach (var (folder, label) in new[] { (desktop, "desktop"), (userPrograms, "startmenu"), (commonPrograms, "commonmenu") })
            {
                if (string.IsNullOrEmpty(folder)) continue;
                try
                {
                    Shortcuts.Create(Path.Combine(folder, Info.ProductName + ".lnk"), exePath, dir, Info.DisplayName, iconForShortcut);
                }
                catch (Exception ex)
                {
                    try { File.AppendAllText(Path.Combine(dir, "install.log"), label + "-shortcut: " + ex.Message + "\r\n"); } catch { }
                }
            }

            report(93, "写入卸载信息…");

            var uninstallPs1 = Path.Combine(dir, "uninstall.ps1");
            var ps1 = string.Join("\r\n", new[]
            {
                "$ErrorActionPreference = 'SilentlyContinue'",
                "$dir = '" + dir.Replace("'", "''") + "'",
                "$name = '" + Info.ProductName.Replace("'", "''") + "'",
                "$exeName = '" + Path.GetFileNameWithoutExtension(Info.AppExe).Replace("'", "''") + "'",
                "$key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + Info.AppId + "'",
                "New-Item -ItemType File -Path (Join-Path $dir 'uninstalling.flag') -Force | Out-Null",
                "for ($i = 0; $i -lt 3; $i++) {",
                "  Get-Process | Where-Object { ($_.Path -like ($dir + '\\*')) -or ($_.ProcessName -eq $exeName) } | Stop-Process -Force",
                "  Start-Sleep -Milliseconds 200",
                "  $busy = Get-Process | Where-Object { ($_.Path -like ($dir + '\\*')) -or ($_.ProcessName -eq $exeName) }",
                "  if (-not $busy) { break }",
                "}",
                "foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('CommonPrograms'))) {",
                "  Remove-Item (Join-Path $d ($name + '.lnk')) -Force",
                "}",
                "Remove-Item $key -Recurse -Force",
                "Remove-Item $dir -Recurse -Force",
                "if (Test-Path $dir) {",
                "  $cmd = Join-Path $env:TEMP ('disi-clean-' + [guid]::NewGuid().ToString('N') + '.cmd')",
                "  Set-Content -Path $cmd -Encoding ASCII -Value @('@echo off', 'timeout /t 1 /nobreak >nul', ('rmdir /s /q ' + [char]34 + $dir + [char]34), ('del /f /q ' + [char]34 + '%~f0' + [char]34))",
                "  Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c ' + [char]34 + $cmd + [char]34) -WindowStyle Hidden",
                "}",
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
                    key.SetValue("DisplayName", Info.DisplayName);
                    key.SetValue("DisplayVersion", Info.Version);
                    key.SetValue("Publisher", Info.Publisher);
                    key.SetValue("InstallLocation", dir);
                    key.SetValue("DisplayIcon", iconForShortcut);
                    var hasUninstaller = File.Exists(uninstallExe);
                    var uninstallCmd = hasUninstaller
                        ? "\"" + uninstallExe + "\" /uninstall"
                        : "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + uninstallPs1 + "\"";
                    var quietCmd = hasUninstaller
                        ? "\"" + uninstallExe + "\" /uninstall /S"
                        : uninstallCmd;
                    key.SetValue("UninstallString", uninstallCmd);
                    key.SetValue("QuietUninstallString", quietCmd);
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

        public static void Uninstall(string dir)
        {
            foreach (var proc in Process.GetProcesses())
            {
                try
                {
                    var path = proc.MainModule?.FileName;
                    if (path != null && (path.StartsWith(dir + "\\", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(proc.ProcessName, Path.GetFileNameWithoutExtension(Info.AppExe), StringComparison.OrdinalIgnoreCase)))
                    {
                        proc.Kill(true);
                        proc.WaitForExit(3000);
                    }
                }
                catch { }
            }

            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var userPrograms = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            var commonPrograms = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
            Shortcuts.Delete(Path.Combine(desktop, Info.ProductName + ".lnk"));
            Shortcuts.Delete(Path.Combine(userPrograms, Info.ProductName + ".lnk"));
            if (!string.IsNullOrEmpty(commonPrograms)) Shortcuts.Delete(Path.Combine(commonPrograms, Info.ProductName + ".lnk"));
            Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
        }

        private const string UninstallKeyUnused = @"";
    }

    internal static class Uninstaller
    {
        public static void Run(bool silent)
        {
            var dir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);

            if (!silent)
            {
                var answer = MessageBox.Show("确定要卸载 " + Info.DisplayName + " 吗？\n程序会被关闭，快捷方式和程序文件都会删除。", "卸载", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (answer != DialogResult.Yes) return;
            }

            try { File.WriteAllText(Path.Combine(dir, "uninstalling.flag"), "1"); } catch { }

            InstallerEngine.Uninstall(dir);

            // 先直接删目录（进程已杀，通常能删干净）
            for (var i = 0; i < 3; i++)
            {
                try
                {
                    if (Directory.Exists(dir)) Directory.Delete(dir, true);
                }
                catch { }
                if (!Directory.Exists(dir)) break;
                System.Threading.Thread.Sleep(200);
            }

            if (!Directory.Exists(dir))
            {
                return;
            }

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
    }
}
