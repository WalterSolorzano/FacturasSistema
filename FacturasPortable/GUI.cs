using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace Launcher
{
    public class LoaderForm : Form
    {
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnStart;
        private Button btnClose;
        private Process serverProcess;
        private string appPath;
        private System.Windows.Forms.Timer healthCheckTimer;
        private int healthCheckAttempts = 0;
        private int selectedPort = 3000;
        
        private NotifyIcon trayIcon;
        private ContextMenu trayMenu;
        private bool isClosing = false;
        
        // --- OTA Updates ---
        private string currentVersion = "v0.1.0";
        private string repoApiUrl = "https://api.github.com/repos/WalterSolorzano/FacturasSistema/releases/latest";
        
        [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn
        (
            int nLeftRect,
            int nTopRect,
            int nRightRect,
            int nBottomRect,
            int nWidthEllipse,
            int nHeightEllipse
        );

        // For dragging borderless form
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        public LoaderForm()
        {
            this.Text = "Lanzador de Sistema de Facturas";
            this.Size = new Size(550, 320);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.FromArgb(249, 250, 251); // Soft gray background
            Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 20, 20));

            // Custom Title Bar
            Panel titleBar = new Panel
            {
                Dock = DockStyle.Top,
                Height = 40,
                BackColor = Color.FromArgb(107, 33, 168) // Purple 800
            };
            titleBar.MouseDown += TitleBar_MouseDown;
            
            Label titleText = new Label
            {
                Text = "Sistema de Gestión de Facturas",
                ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 11, FontStyle.Bold),
                Location = new Point(15, 10),
                AutoSize = true
            };
            titleText.MouseDown += TitleBar_MouseDown;
            titleBar.Controls.Add(titleText);

            Button btnMin = new Button
            {
                Text = "—",
                Size = new Size(40, 40),
                Location = new Point(this.Width - 80, 0),
                FlatStyle = FlatStyle.Flat,
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnMin.FlatAppearance.BorderSize = 0;
            btnMin.Click += (s, e) => { this.WindowState = FormWindowState.Minimized; };
            titleBar.Controls.Add(btnMin);

            Button btnCloseApp = new Button
            {
                Text = "✕",
                Size = new Size(40, 40),
                Location = new Point(this.Width - 40, 0),
                FlatStyle = FlatStyle.Flat,
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnCloseApp.FlatAppearance.BorderSize = 0;
            btnCloseApp.FlatAppearance.MouseOverBackColor = Color.FromArgb(220, 53, 69);
            btnCloseApp.Click += (s, e) => this.Close();
            titleBar.Controls.Add(btnCloseApp);

            this.Controls.Add(titleBar);

            // Tray Icon Setup
            trayMenu = new ContextMenu();
            trayMenu.MenuItems.Add("Abrir Aplicación", (s, e) => {
                Process.Start(new ProcessStartInfo(string.Format("http://127.0.0.1:{0}", selectedPort)) { UseShellExecute = true });
            });
            trayMenu.MenuItems.Add("Mostrar Ventana", (s, e) => RestoreWindow());
            trayMenu.MenuItems.Add("-");
            trayMenu.MenuItems.Add("Salir Completamente", (s, e) => {
                isClosing = true;
                this.Close();
            });

            trayIcon = new NotifyIcon
            {
                Text = "Sistema de Facturas",
                Icon = SystemIcons.Application,
                ContextMenu = trayMenu,
                Visible = true
            };
            trayIcon.DoubleClick += (s, e) => RestoreWindow();

            this.FormClosing += LoaderForm_FormClosing;
            this.Resize += LoaderForm_Resize;

            // Content Area
            Panel contentPanel = new Panel
            {
                Location = new Point(20, 60),
                Size = new Size(510, 240),
                BackColor = Color.White
            };
            contentPanel.Region = System.Drawing.Region.FromHrgn(CreateRoundRectRgn(0, 0, contentPanel.Width, contentPanel.Height, 10, 10));

            Label welcomeLabel = new Label
            {
                Text = "Bienvenido al Sistema",
                Font = new Font("Segoe UI", 18, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(20, 20),
                ForeColor = Color.FromArgb(17, 24, 39) // Gray 900
            };
            contentPanel.Controls.Add(welcomeLabel);

            lblStatus = new Label
            {
                Text = "Listo para iniciar el servidor local.",
                Location = new Point(25, 65),
                AutoSize = true,
                Font = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(107, 114, 128) // Gray 500
            };
            contentPanel.Controls.Add(lblStatus);

            progressBar = new ProgressBar
            {
                Location = new Point(25, 100),
                Size = new Size(460, 15),
                Style = ProgressBarStyle.Continuous
            };
            contentPanel.Controls.Add(progressBar);

            btnStart = new Button
            {
                Text = "INICIAR SERVIDOR",
                Location = new Point(140, 150),
                Size = new Size(230, 45),
                BackColor = Color.FromArgb(107, 33, 168),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnStart.FlatAppearance.BorderSize = 0;
            btnStart.Click += BtnStart_Click;
            contentPanel.Controls.Add(btnStart);

            this.Controls.Add(contentPanel);

            appPath = AppDomain.CurrentDomain.BaseDirectory;

            // Load Version
            string versionFile = Path.Combine(appPath, "version.txt");
            if (File.Exists(versionFile)) {
                currentVersion = File.ReadAllText(versionFile).Trim();
            }

            Label lblVersion = new Label {
                Text = "Versión: " + currentVersion,
                Location = new Point(20, 205),
                AutoSize = true,
                Font = new Font("Segoe UI", 8),
                ForeColor = Color.Gray
            };
            contentPanel.Controls.Add(lblVersion);

            // Check if Backup exists for Rollback
            if (Directory.Exists(Path.Combine(appPath, "app_backup"))) {
                Button btnRollback = new Button {
                    Text = "Restaurar Versión Anterior",
                    Location = new Point(330, 200),
                    Size = new Size(160, 28),
                    BackColor = Color.FromArgb(220, 53, 69),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 8, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };
                btnRollback.FlatAppearance.BorderSize = 0;
                btnRollback.Click += BtnRollback_Click;
                contentPanel.Controls.Add(btnRollback);
            }

            this.Shown += LoaderForm_Shown;
        }

        private void TitleBar_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
            }
        }

        private void RestoreWindow()
        {
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.Activate();
        }

        private void LoaderForm_Resize(object sender, EventArgs e)
        {
            if (this.WindowState == FormWindowState.Minimized)
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    trayIcon.ShowBalloonTip(3000, "El sistema sigue en ejecución", "El servidor de facturas se ha minimizado pero sigue activo.", ToolTipIcon.Info);
                    this.Hide();
                }
            }
        }

        private void BtnStart_Click(object sender, EventArgs e)
        {
            btnStart.Enabled = false;
            progressBar.Style = ProgressBarStyle.Marquee;
            lblStatus.Text = "Buscando puerto disponible y configurando red...";
            
            Thread initThread = new Thread(() => 
            {
                try
                {
                    selectedPort = GetAvailablePort(3000);
                    KillPort(selectedPort);
                    
                    this.Invoke(new Action(() => {
                        lblStatus.Text = string.Format("Iniciando aplicación web en puerto {0}...", selectedPort);
                    }));

                    LaunchServer();

                    this.Invoke(new Action(() => {
                        lblStatus.Text = "Esperando que el servidor responda...";
                        StartHealthCheck();
                    }));
                }
                catch (Exception ex)
                {
                    this.Invoke(new Action(() => {
                        MessageBox.Show("Error al iniciar: " + ex.Message, "Error Crítico", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ResetUI();
                    }));
                }
            });
            initThread.IsBackground = true;
            initThread.Start();
        }

        private void LoaderForm_Shown(object sender, EventArgs e)
        {
            Thread updateThread = new Thread(CheckForUpdates);
            updateThread.IsBackground = true;
            updateThread.Start();
        }

        private void CheckForUpdates()
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                using (WebClient wc = new WebClient())
                {
                    wc.Headers.Add("User-Agent", "Updater-Facturas");
                    string json = wc.DownloadString(repoApiUrl);
                    
                    string tagMarker = "\"tag_name\":";
                    int idx = json.IndexOf(tagMarker);
                    if (idx > 0)
                    {
                        int start = json.IndexOf("\"", idx + tagMarker.Length) + 1;
                        int end = json.IndexOf("\"", start);
                        string latestVersion = json.Substring(start, end - start);
                        
                        if (latestVersion != currentVersion && IsVersionGreater(latestVersion, currentVersion))
                        {
                            string assetMarker = "\"browser_download_url\":";
                            int aIdx = json.IndexOf(assetMarker);
                            if (aIdx > 0)
                            {
                                int aStart = json.IndexOf("\"", aIdx + assetMarker.Length) + 1;
                                int aEnd = json.IndexOf("\"", aStart);
                                string downloadUrl = json.Substring(aStart, aEnd - aStart);
                                
                                this.Invoke(new Action(() => {
                                    var result = MessageBox.Show(string.Format("¡Nueva versión {0} disponible!\n\n¿Deseas descargarla e instalarla ahora?", latestVersion), "Actualización Disponible", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                                    if (result == DialogResult.Yes) {
                                        PerformUpdate(downloadUrl);
                                    }
                                }));
                            }
                        }
                    }
                }
            }
            catch { /* Ignorar errores de red en la búsqueda de actualizaciones */ }
        }

        private bool IsVersionGreater(string vLatest, string vCurrent)
        {
            try {
                Version l = new Version(vLatest.Replace("v", ""));
                Version c = new Version(vCurrent.Replace("v", ""));
                return l > c;
            } catch { return false; }
        }

        private void PerformUpdate(string downloadUrl)
        {
            btnStart.Enabled = false;
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Value = 0;
            lblStatus.Text = "Descargando actualización...";
            
            WebClient wc = new WebClient();
            wc.Headers.Add("User-Agent", "Updater-Facturas");
            wc.DownloadProgressChanged += (s, e) => {
                progressBar.Value = e.ProgressPercentage;
            };
            wc.DownloadFileCompleted += (s, e) => {
                if (e.Error != null) {
                    MessageBox.Show("Error al descargar la actualización: " + e.Error.Message);
                    ResetUI();
                    return;
                }
                
                lblStatus.Text = "Instalando actualización...";
                try {
                    string appFolder = Path.Combine(appPath, "app");
                    string backupFolder = Path.Combine(appPath, "app_backup");
                    if (Directory.Exists(backupFolder)) {
                        Directory.Delete(backupFolder, true);
                    }
                    if (Directory.Exists(appFolder)) {
                        Process xcopy = new Process();
                        xcopy.StartInfo.FileName = "cmd.exe";
                        xcopy.StartInfo.Arguments = string.Format("/c xcopy /e /i /y \"{0}\" \"{1}\"", appFolder, backupFolder);
                        xcopy.StartInfo.CreateNoWindow = true;
                        xcopy.StartInfo.UseShellExecute = false;
                        xcopy.Start();
                        xcopy.WaitForExit();
                    }
                    
                    string tempExe = Path.Combine(Path.GetTempPath(), "UpdateFacturas.exe");
                    Process.Start(new ProcessStartInfo(tempExe) { UseShellExecute = true });
                    Application.Exit();
                } catch (Exception ex) {
                    MessageBox.Show("Error al instalar: " + ex.Message);
                    ResetUI();
                }
            };
            
            wc.DownloadFileAsync(new Uri(downloadUrl), Path.Combine(Path.GetTempPath(), "UpdateFacturas.exe"));
        }

        private void BtnRollback_Click(object sender, EventArgs e)
        {
            var result = MessageBox.Show("¿Seguro que deseas volver a la versión anterior?\nSe restaurará el programa tal y como estaba antes de la última actualización.", "Restaurar Versión", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (result == DialogResult.Yes)
            {
                try
                {
                    KillServer();
                    string appFolder = Path.Combine(appPath, "app");
                    string backupFolder = Path.Combine(appPath, "app_backup");
                    
                    Process cmd = new Process();
                    cmd.StartInfo.FileName = "cmd.exe";
                    cmd.StartInfo.Arguments = string.Format("/c rmdir /s /q \"{0}\" & xcopy /e /i /y \"{1}\" \"{0}\" & rmdir /s /q \"{1}\"", appFolder, backupFolder);
                    cmd.StartInfo.CreateNoWindow = true;
                    cmd.StartInfo.UseShellExecute = false;
                    cmd.Start();
                    cmd.WaitForExit();
                    
                    MessageBox.Show("Se ha restaurado la versión anterior. El programa se reiniciará.", "Éxito", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    
                    Process.Start(new ProcessStartInfo(Application.ExecutablePath) { UseShellExecute = true });
                    Application.Exit();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error al restaurar: " + ex.Message);
                }
            }
        }

        private int GetAvailablePort(int startPort)
        {
            int port = startPort;
            while (port < startPort + 10)
            {
                bool isAvailable = true;
                try
                {
                    TcpListener tcpListener = new TcpListener(IPAddress.Loopback, port);
                    tcpListener.Start();
                    tcpListener.Stop();
                }
                catch
                {
                    isAvailable = false;
                }

                if (isAvailable) return port;
                port++;
            }
            return startPort;
        }

        private void KillPort(int port)
        {
            try
            {
                Process p = new Process();
                p.StartInfo.FileName = "cmd.exe";
                p.StartInfo.Arguments = string.Format("/c netstat -ano | findstr :{0}", port);
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                string output = p.StandardOutput.ReadToEnd();
                p.WaitForExit();

                if (!string.IsNullOrEmpty(output))
                {
                    string[] lines = output.Split(new[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (string line in lines)
                    {
                        string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 4)
                        {
                            string pid = parts[parts.Length - 1];
                            Process killP = new Process();
                            killP.StartInfo.FileName = "cmd.exe";
                            killP.StartInfo.Arguments = string.Format("/c taskkill /PID {0} /F /T", pid);
                            killP.StartInfo.UseShellExecute = false;
                            killP.StartInfo.CreateNoWindow = true;
                            killP.Start();
                            killP.WaitForExit();
                        }
                    }
                }
            }
            catch { }
        }

        private void LaunchServer()
        {
            try
            {
                // Init Database file
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string dbDir = Path.Combine(appData, "FacturasApp");
                string dbPath = Path.Combine(dbDir, "custom.db");

                if (!File.Exists(dbPath))
                {
                    if (!Directory.Exists(dbDir)) Directory.CreateDirectory(dbDir);
                    string bundledDb = Path.Combine(appPath, "app", "prisma", "db", "custom.db");
                    if (File.Exists(bundledDb))
                    {
                        File.Copy(bundledDb, dbPath);
                    }
                }

                // Force write the correct .env so Prisma standalone doesn't try to use invalid paths
                try
                {
                    string envPath = Path.Combine(appPath, "app", ".env");
                    File.WriteAllText(envPath, "DATABASE_URL=\"file:" + dbPath.Replace("\\", "/") + "\"");
                }
                catch { } // Ignorar si no hay permisos de escritura (ej. Program Files). Se usará la variable de entorno.

                // Find node/bun relative to standard Next.js standalone execution
                string serverJs = Path.Combine(appPath, "app", "server.js");
                
                string exePath = "bun.exe"; 
                if (File.Exists(Path.Combine(appPath, "bun.exe")))
                {
                    exePath = Path.Combine(appPath, "bun.exe");
                }
                else if (File.Exists(Path.Combine(appPath, "node_zemer.exe")))
                {
                    exePath = Path.Combine(appPath, "node_zemer.exe");
                }

                serverProcess = new Process();
                serverProcess.StartInfo.FileName = exePath;
                serverProcess.StartInfo.Arguments = "\"" + serverJs + "\"";
                serverProcess.StartInfo.WorkingDirectory = Path.Combine(appPath, "app");
                serverProcess.StartInfo.UseShellExecute = false;
                serverProcess.StartInfo.CreateNoWindow = true;
                
                serverProcess.StartInfo.RedirectStandardOutput = true;
                serverProcess.StartInfo.RedirectStandardError = true;

                // Env variables
                serverProcess.StartInfo.EnvironmentVariables["PORT"] = selectedPort.ToString();
                serverProcess.StartInfo.EnvironmentVariables["NODE_ENV"] = "production";
                serverProcess.StartInfo.EnvironmentVariables["DATABASE_URL"] = "file:" + dbPath.Replace("\\", "/");

                serverProcess.Start();
                
                // Read logs to server_log.txt for debugging
                string logFile = Path.Combine(dbDir, "server_log.txt"); // Guardar en AppData para evitar errores de permisos
                try { File.WriteAllText(logFile, "Iniciando servidor...\n"); } catch { }
                serverProcess.OutputDataReceived += (s, ev) => { if (ev.Data != null) { try { File.AppendAllText(logFile, ev.Data + Environment.NewLine); } catch { } } };
                serverProcess.ErrorDataReceived += (s, ev) => { if (ev.Data != null) { try { File.AppendAllText(logFile, "ERROR: " + ev.Data + Environment.NewLine); } catch { } } };
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                throw new Exception("No se pudo iniciar el proceso del servidor. Asegúrese de que bun.exe/node_zemer.exe y server.js estén presentes. Detalle: " + ex.Message);
            }
        }

        private void StartHealthCheck()
        {
            healthCheckAttempts = 0;
            healthCheckTimer = new System.Windows.Forms.Timer();
            healthCheckTimer.Interval = 2000;
            healthCheckTimer.Tick += HealthCheckTimer_Tick;
            healthCheckTimer.Start();
        }

        private async void HealthCheckTimer_Tick(object sender, EventArgs e)
        {
            healthCheckAttempts++;
            if (healthCheckAttempts > 30)
            {
                healthCheckTimer.Stop();
                MessageBox.Show("El servidor tardó demasiado en responder o hubo un error interno en la base de datos.", "Error de Timeout", MessageBoxButtons.OK, MessageBoxIcon.Error);
                ResetUI();
                return;
            }

            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(string.Format("http://127.0.0.1:{0}/api/health", selectedPort));
                request.Timeout = 1500;
                
                // Usamos Task.Run para llamar al método síncrono que sí respeta el Timeout
                using (WebResponse response = await System.Threading.Tasks.Task.Run(() => request.GetResponse()))
                {
                    HttpWebResponse httpResponse = (HttpWebResponse)response;
                    if (httpResponse.StatusCode == HttpStatusCode.OK)
                    {
                        healthCheckTimer.Stop();
                        progressBar.Style = ProgressBarStyle.Blocks;
                        progressBar.Value = 100;
                        lblStatus.Text = "¡Sistema Activo! Puedes minimizar esta ventana.";
                        
                        btnStart.Text = "ABRIR NAVEGADOR";
                        btnStart.Enabled = true;
                        
                        // Switch behavior of button to open browser
                        btnStart.Click -= BtnStart_Click;
                        btnStart.Click += (s, evArgs) => {
                            Process.Start(new ProcessStartInfo(string.Format("http://127.0.0.1:{0}", selectedPort)) { UseShellExecute = true });
                        };
                        
                        Process.Start(new ProcessStartInfo(string.Format("http://127.0.0.1:{0}", selectedPort)) { UseShellExecute = true });
                        
                        // Auto-minimize after a brief delay
                        System.Windows.Forms.Timer minTimer = new System.Windows.Forms.Timer();
                        minTimer.Interval = 3000;
                        minTimer.Tick += (s, evArgs) => {
                            this.WindowState = FormWindowState.Minimized;
                            minTimer.Stop();
                        };
                        minTimer.Start();
                    }
                }
            }
            catch
            {
                // Aún no está listo, espera al siguiente tick
            }
        }

        private void ResetUI()
        {
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Value = 0;
            btnStart.Enabled = true;
            btnStart.Text = "INICIAR SERVIDOR";
            lblStatus.Text = "Listo para iniciar el servidor local.";
            KillServer();
        }

        private void KillServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    // Utilizar taskkill para asegurar que se maten todos los hijos
                    Process killP = new Process();
                    killP.StartInfo.FileName = "cmd.exe";
                    killP.StartInfo.Arguments = string.Format("/c taskkill /PID {0} /F /T", serverProcess.Id);
                    killP.StartInfo.UseShellExecute = false;
                    killP.StartInfo.CreateNoWindow = true;
                    killP.Start();
                    killP.WaitForExit();
                }
            }
            catch { }
            finally
            {
                // Limpieza agresiva del puerto por si acaso
                KillPort(selectedPort);
            }
        }

        private void LoaderForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing || isClosing)
            {
                KillServer();
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
                return;
            }

            if (serverProcess != null && !serverProcess.HasExited)
            {
                e.Cancel = true;
                this.WindowState = FormWindowState.Minimized;
                trayIcon.ShowBalloonTip(3000, "Sistema oculto", "La ventana se ha ocultado pero el servidor sigue corriendo. Para salir, haz clic derecho en este ícono.", ToolTipIcon.Info);
            }
            else
            {
                KillServer();
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
            }
        }

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main()
        {
            try { SetProcessDPIAware(); } catch { }

            // --- PROTECCIÓN CONTRA FANTASMAS Y VERSIONES VIEJAS ---
            try
            {
                int currentPid = Process.GetCurrentProcess().Id;
                string currentName = Process.GetCurrentProcess().ProcessName;
                foreach (Process p in Process.GetProcessesByName(currentName))
                {
                    if (p.Id != currentPid)
                    {
                        try { p.Kill(); p.WaitForExit(1000); } catch { }
                    }
                }
            }
            catch { }
            // --------------------------------------------------------

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // Unhandled exception handlers para evitar crashes feos
            Application.ThreadException += (s, args) => 
            {
                MessageBox.Show("Error inesperado en UI: " + args.Exception.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };
            AppDomain.CurrentDomain.UnhandledException += (s, args) => 
            {
                Exception e = (Exception)args.ExceptionObject;
                MessageBox.Show("Error fatal del sistema: " + e.Message, "Fallo Crítico", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };

            Application.Run(new LoaderForm());
        }
    }
}