using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Web.Script.Serialization;
using System.Threading;
using System.Windows.Forms;
using System.Collections.Generic;

namespace Launcher
{
    public class LoaderForm : Form
    {
        // ============================================================
        // CONSTANTES DE CONFIGURACIÓN
        // ============================================================
        private const int    PORT               = 3000;
        private const int    MAX_PORT_RETRIES   = 5;
        private const int    SERVER_TIMEOUT_SEC = 60;
        private const string APP_NAME           = "FacturasApp";
        private const string HEALTH_URL_TMPL    = "http://localhost:{0}/api/health";
        private const string UPDATE_CONFIG_FILE  = "update-config.json";
        private const string UPDATE_SCRIPT_FILE  = "FacturasApp_update.ps1";

        // ============================================================
        // CONTROLES UI
        // ============================================================
        private Button      startBtn;
        private Label       statusLbl;
        private Label       detailLbl;
        private ProgressBar pBar;
        private Process     serverProcess;
        private int         activePort = PORT;
        private bool        serverReady = false;
        private bool        startupBusy = false;

        private class UpdateConfig
        {
            public string current_version { get; set; }
            public string manifest_url { get; set; }
        }

        private class UpdateManifest
        {
            public string version { get; set; }
            public string download_url { get; set; }
            public string notes { get; set; }
        }

        // ============================================================
        // CONSTRUCTOR
        // ============================================================
        public LoaderForm()
        {
            this.Text            = "Sistema de Facturas";
            this.Size            = new Size(430, 290);
            this.StartPosition   = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox     = false;
            this.BackColor       = Color.FromArgb(18, 24, 38);

            try { this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            // --- Título principal ---
            Label title  = new Label();
            title.Text      = "SISTEMA DE FACTURAS";
            title.Font      = new Font("Segoe UI", 15, FontStyle.Bold);
            title.ForeColor = Color.White;
            title.Size      = new Size(400, 34);
            title.Left      = (this.ClientSize.Width - 400) / 2;
            title.Top       = 28;
            title.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(title);

            // --- Subtítulo ---
            Label subtitle  = new Label();
            subtitle.Text      = "Registro y consulta de facturas";
            subtitle.Font      = new Font("Segoe UI", 9);
            subtitle.ForeColor = Color.FromArgb(120, 140, 170);
            subtitle.Size      = new Size(400, 20);
            subtitle.Left      = (this.ClientSize.Width - 400) / 2;
            subtitle.Top       = 62;
            subtitle.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(subtitle);

            // --- Estado principal ---
            statusLbl           = new Label();
            statusLbl.Text      = "Listo para iniciar.";
            statusLbl.Font      = new Font("Segoe UI", 10, FontStyle.Bold);
            statusLbl.ForeColor = Color.FromArgb(150, 200, 255);
            statusLbl.Size      = new Size(390, 22);
            statusLbl.Left      = 20;
            statusLbl.Top       = 100;
            statusLbl.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(statusLbl);

            // --- Detalle técnico ---
            detailLbl           = new Label();
            detailLbl.Text      = "";
            detailLbl.Font      = new Font("Segoe UI", 8);
            detailLbl.ForeColor = Color.FromArgb(90, 110, 140);
            detailLbl.Size      = new Size(390, 18);
            detailLbl.Left      = 20;
            detailLbl.Top       = 126;
            detailLbl.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(detailLbl);

            // --- Barra de progreso ---
            pBar               = new ProgressBar();
            pBar.Style         = ProgressBarStyle.Marquee;
            pBar.MarqueeAnimationSpeed = 25;
            pBar.Size          = new Size(390, 6);
            pBar.Location      = new Point(20, 155);
            pBar.Visible       = false;
            this.Controls.Add(pBar);

            // --- Botón principal ---
            startBtn           = new Button();
            startBtn.Text      = "INICIAR SISTEMA";
            startBtn.Font      = new Font("Segoe UI", 12, FontStyle.Bold);
            startBtn.BackColor = Color.FromArgb(99, 102, 241);
            startBtn.ForeColor = Color.White;
            startBtn.FlatStyle = FlatStyle.Flat;
            startBtn.FlatAppearance.BorderSize  = 0;
            startBtn.Size      = new Size(240, 48);
            startBtn.Location  = new Point((this.ClientSize.Width - 240) / 2, 188);
            startBtn.Cursor    = Cursors.Hand;
            startBtn.Click    += StartBtn_Click;
            this.Controls.Add(startBtn);

            this.FormClosing += LoaderForm_FormClosing;
        }

        // ============================================================
        // CLICK INICIAR
        // ============================================================
        private void StartBtn_Click(object sender, EventArgs e)
        {
            if (startupBusy) return;

            startBtn.Enabled = false;
            pBar.Visible     = true;
            SetStatus("Verificando actualizaciones...", "Consultando GitHub");
            startupBusy = true;

            Thread t = new Thread(new ThreadStart(PrepareStartup));
            t.IsBackground = true;
            t.Start();
        }

        private void PrepareStartup()
        {
            try
            {
                if (TryApplyUpdateIfAvailable())
                {
                    return;
                }
            }
            catch (Exception ex)
            {
                try
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show(
                            "No se pudo completar la verificacion de actualizaciones.\n\n" + ex.Message + "\n\nSe continuara con el inicio normal.",
                            "Sistema de Facturas",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    });
                }
                catch { }
            }

            LaunchServer();
        }

        // ============================================================
        // UTILIDAD: actualizar UI desde hilo secundario (thread-safe)
        // ============================================================
        private void SetStatus(string main, string detail)
        {
            SetStatus(main, detail, Color.FromArgb(150, 200, 255));
        }

        private void SetStatus(string main, string detail, Color color)
        {
            if (this.IsDisposed) return;
            try
            {
                this.Invoke((MethodInvoker)delegate
                {
                    statusLbl.Text      = main;
                    detailLbl.Text      = detail;
                    statusLbl.ForeColor = color;
                });
            }
            catch { }
        }

        // ============================================================
        // VERIFICAR SI UN PUERTO ESTÁ LIBRE (TcpListener)
        // ============================================================
        private bool IsPortFree(int port)
        {
            try
            {
                TcpListener listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return true;
            }
            catch { return false; }
        }

        // ============================================================
        // ENCONTRAR PRIMER PUERTO DISPONIBLE
        // ============================================================
        private int FindFreePort(int basePort)
        {
            for (int i = 0; i < MAX_PORT_RETRIES; i++)
            {
                int p = basePort + i;
                if (IsPortFree(p)) return p;
            }
            return -1;
        }

        // ============================================================
        // VERIFICAR TCP: intenta conectar al puerto
        // ============================================================
        private bool IsTcpPortOpen(int port)
        {
            try
            {
                using (TcpClient tcp = new TcpClient())
                {
                    IAsyncResult ar = tcp.BeginConnect(IPAddress.Loopback, port, null, null);
                    bool connected  = ar.AsyncWaitHandle.WaitOne(1200);
                    if (connected && tcp.Connected)
                    {
                        tcp.EndConnect(ar);
                        return true;
                    }
                    return false;
                }
            }
            catch { return false; }
        }

        // ============================================================
        // HEALTH-CHECK: espera que el servidor responda (WebRequest)
        // Compatible con .NET Framework 4.0 / C# 5
        // ============================================================
        private bool WaitForServer(int port, int timeoutSeconds)
        {
            string url      = string.Format(HEALTH_URL_TMPL, port);
            DateTime deadline = DateTime.Now.AddSeconds(timeoutSeconds);
            int attempt     = 0;

            while (DateTime.Now < deadline)
            {
                attempt++;
                SetStatus(
                    "Iniciando servidor...",
                    string.Format("Verificando conexion... intento {0}", attempt)
                );

                // Paso 1: verificar TCP primero (rápido)
                if (!IsTcpPortOpen(port))
                {
                    Thread.Sleep(1000);
                    continue;
                }

                // Paso 2: TCP está arriba, verificar HTTP
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                    req.Timeout        = 2000;
                    req.Method         = "GET";
                    req.AllowAutoRedirect = false;

                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        int code = (int)resp.StatusCode;
                        // 200–499 = el servidor está respondiendo correctamente
                        if (code < 500) return true;
                    }
                }
                catch (WebException wex)
                {
                    // El servidor existe pero retornó error (404 también es válido — servidor arriba)
                    if (wex.Response != null)
                    {
                        int code = (int)((HttpWebResponse)wex.Response).StatusCode;
                        if (code < 500) return true;
                    }
                    // Si no hay respuesta: servidor todavía no listo
                }
                catch { }

                Thread.Sleep(1000);
            }
            return false;
        }

        // ============================================================
        // MATAR PROCESO QUE OCUPA UN PUERTO (liberar el puerto)
        // ============================================================
        private void KillProcessOnPort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe");
                psi.Arguments = string.Format(
                    "/C for /f \"tokens=5\" %a in ('netstat -aon 2^>nul ^| findstr \":{0}\" ^| findstr \"LISTEN\"') do taskkill /F /PID %a 2^>nul",
                    port
                );
                psi.UseShellExecute  = false;
                psi.CreateNoWindow   = true;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(3000);
            }
            catch { /* ignorar si falla */ }
        }

        // ============================================================
        // LANZAR SERVIDOR (ejecutado en hilo secundario)
        // ============================================================
        private void LaunchServer()
        {
            try
            {
                // --- 1. Verificar archivos requeridos ---
                string baseDir  = AppDomain.CurrentDomain.BaseDirectory;
                string bunPath  = Path.Combine(baseDir, "bun.exe");
                string serverJs = Path.Combine(baseDir, "app", "server.js");

                if (!File.Exists(bunPath) || !File.Exists(serverJs))
                {
                    ShowError(
                        "Archivos del sistema no encontrados.\n\n" +
                        "Asegurate de ejecutar el programa DENTRO de su carpeta (FacturasPortable),\n" +
                        "sin sacar el .exe fuera de esa carpeta.\n\n" +
                        "Archivos requeridos:\n  bun.exe\n  app\\server.js"
                    );
                    return;
                }

                // --- 2. Matar instancias previas que ocupan el puerto ---
                SetStatus("Preparando entorno...", "Verificando procesos previos en puerto " + PORT);
                KillProcessOnPort(PORT);
                Thread.Sleep(700);

                // --- 3. Encontrar puerto disponible ---
                SetStatus("Buscando puerto disponible...", "");
                activePort = FindFreePort(PORT);

                if (activePort == -1)
                {
                    ShowError(
                        "No se pudo encontrar un puerto disponible.\n\n" +
                        "Los puertos " + PORT + " al " + (PORT + MAX_PORT_RETRIES - 1) + " estan todos ocupados.\n\n" +
                        "Cierra otros programas e intentalo de nuevo."
                    );
                    return;
                }

                // --- 4. Preparar base de datos ---
                SetStatus("Inicializando base de datos...", "Preparando almacenamiento");

                string appData   = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    APP_NAME
                );
                if (!Directory.Exists(appData))
                    Directory.CreateDirectory(appData);

                string dbPath    = Path.Combine(appData, "custom.db");
                string bundledDb = Path.Combine(baseDir, "db", "custom.db");

                if (!File.Exists(dbPath) && File.Exists(bundledDb))
                {
                    File.Copy(bundledDb, dbPath);
                    SetStatus("Base de datos inicializada.", "Primera ejecucion completada");
                    Thread.Sleep(400);
                }

                // --- 5. Lanzar el servidor ---
                SetStatus("Lanzando servidor...", "Puerto " + activePort.ToString());

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName               = bunPath;
                psi.Arguments              = "\"" + serverJs + "\"";
                psi.UseShellExecute        = false;
                psi.CreateNoWindow         = true;
                psi.RedirectStandardOutput = false;
                psi.RedirectStandardError  = false;
                psi.WorkingDirectory       = baseDir;

                psi.EnvironmentVariables["NODE_ENV"]     = "production";
                psi.EnvironmentVariables["DATABASE_URL"] = "file:" + dbPath.Replace("\\", "/");
                psi.EnvironmentVariables["PORT"]         = activePort.ToString();
                psi.EnvironmentVariables["HOSTNAME"]     = "127.0.0.1";

                serverProcess = new Process();
                serverProcess.StartInfo            = psi;
                serverProcess.EnableRaisingEvents  = true;
                serverProcess.Exited              += ServerProcess_Exited;
                serverProcess.Start();

                // --- 6. Esperar health-check real ---
                bool ready = WaitForServer(activePort, SERVER_TIMEOUT_SEC);

                if (!ready)
                {
                    // Matar el proceso si no respondió
                    try { if (serverProcess != null && !serverProcess.HasExited) serverProcess.Kill(); } catch { }

                    ShowError(
                        "El servidor tardo demasiado en iniciarse (" + SERVER_TIMEOUT_SEC + " segundos).\n\n" +
                        "Posibles causas:\n" +
                        "  Antivirus bloqueando bun.exe\n" +
                        "  Permisos insuficientes en la carpeta\n" +
                        "  Recursos insuficientes en el equipo\n\n" +
                        "Intenta ejecutar como Administrador (clic derecho -> Ejecutar como administrador)."
                    );
                    return;
                }

                serverReady = true;

                // --- 7. Abrir navegador ---
                SetStatus("Sistema listo.", "Abriendo en el navegador...");
                Thread.Sleep(300);

                string url = string.Format("http://localhost:{0}", activePort);
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });

                // --- 8. Actualizar UI a modo "corriendo" ---
                if (this.IsDisposed) return;
                this.Invoke((MethodInvoker)delegate
                {
                    statusLbl.Text      = "Sistema corriendo correctamente";
                    statusLbl.ForeColor = Color.FromArgb(74, 222, 128);
                    detailLbl.Text      = "http://localhost:" + activePort + "   —   Cierra esta ventana para apagar el sistema";
                    detailLbl.ForeColor = Color.FromArgb(90, 110, 140);

                    pBar.Visible        = false;

                    // Reutilizar startBtn para abrir el navegador
                    startBtn.Text       = "Abrir en el Navegador";
                    startBtn.BackColor  = Color.FromArgb(34, 197, 94);
                    startBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(22, 163, 74);
                    startBtn.Enabled    = true;

                    startBtn.Click -= StartBtn_Click;
                    startBtn.Click += delegate
                    {
                        string u = string.Format("http://localhost:{0}", activePort);
                        Process.Start(new ProcessStartInfo(u) { UseShellExecute = true });
                    };

                    // Botón de detener separado (más abajo)
                    Button stopBtn = new Button();
                    stopBtn.Text   = "Detener Sistema";
                    stopBtn.Font   = new Font("Segoe UI", 9);
                    stopBtn.BackColor = Color.FromArgb(239, 68, 68);
                    stopBtn.ForeColor = Color.White;
                    stopBtn.FlatStyle = FlatStyle.Flat;
                    stopBtn.FlatAppearance.BorderSize = 0;
                    stopBtn.Size   = new Size(140, 32);
                    stopBtn.Location = new Point((this.ClientSize.Width - 140) / 2, 248);
                    stopBtn.Cursor = Cursors.Hand;
                    stopBtn.Click += delegate { this.Close(); };
                    this.Controls.Add(stopBtn);

                    this.Size = new Size(430, 318);
                });
            }
            catch (Exception ex)
            {
                ShowError("Error inesperado al iniciar el sistema:\n\n" + ex.Message);
            }
        }

        private UpdateConfig LoadUpdateConfig(string baseDir)
        {
            string configPath = Path.Combine(baseDir, UPDATE_CONFIG_FILE);
            if (!File.Exists(configPath)) return null;

            string json = File.ReadAllText(configPath, Encoding.UTF8);
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            Dictionary<string, object> data = serializer.Deserialize<Dictionary<string, object>>(json);

            UpdateConfig config = new UpdateConfig();
            if (data.ContainsKey("current_version") && data["current_version"] != null)
                config.current_version = data["current_version"].ToString();
            if (data.ContainsKey("manifest_url") && data["manifest_url"] != null)
                config.manifest_url = data["manifest_url"].ToString();

            if (string.IsNullOrWhiteSpace(config.current_version) || string.IsNullOrWhiteSpace(config.manifest_url))
                return null;

            return config;
        }

        private UpdateManifest LoadRemoteManifest(string manifestUrl)
        {
            using (WebClient client = new WebClient())
            {
                client.Headers.Add("User-Agent", "FacturasApp-Portable-Updater");
                string json = client.DownloadString(manifestUrl);
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                Dictionary<string, object> data = serializer.Deserialize<Dictionary<string, object>>(json);

                UpdateManifest manifest = new UpdateManifest();
                if (data.ContainsKey("version") && data["version"] != null)
                    manifest.version = data["version"].ToString();
                if (data.ContainsKey("download_url") && data["download_url"] != null)
                    manifest.download_url = data["download_url"].ToString();
                if (data.ContainsKey("notes") && data["notes"] != null)
                    manifest.notes = data["notes"].ToString();

                return manifest;
            }
        }

        private bool TryApplyUpdateIfAvailable()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            UpdateConfig config = LoadUpdateConfig(baseDir);
            if (config == null) return false;

            Version currentVersion;
            if (!Version.TryParse(config.current_version, out currentVersion)) return false;

            UpdateManifest manifest = LoadRemoteManifest(config.manifest_url);
            if (manifest == null) return false;
            if (string.IsNullOrWhiteSpace(manifest.version) || string.IsNullOrWhiteSpace(manifest.download_url)) return false;

            Version remoteVersion;
            if (!Version.TryParse(manifest.version, out remoteVersion)) return false;
            if (remoteVersion.CompareTo(currentVersion) <= 0) return false;

            try
            {
                this.Invoke((MethodInvoker)delegate
                {
                    SetStatus("Actualización disponible.", "Descargando nueva versión " + manifest.version);
                });
            }
            catch { }

            string tempRoot = Path.Combine(Path.GetTempPath(), "FacturasApp_Updates");
            if (!Directory.Exists(tempRoot)) Directory.CreateDirectory(tempRoot);

            string workDir = Path.Combine(tempRoot, "package_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(workDir);

            string zipPath = Path.Combine(workDir, "update.zip");
            using (WebClient client = new WebClient())
            {
                client.Headers.Add("User-Agent", "FacturasApp-Portable-Updater");
                client.DownloadFile(manifest.download_url, zipPath);
            }

            string extractDir = Path.Combine(workDir, "extracted");
            Directory.CreateDirectory(extractDir);
            ZipFile.ExtractToDirectory(zipPath, extractDir);

            StartUpdateApplierScript(baseDir, extractDir);

            try { this.BeginInvoke((MethodInvoker)delegate { this.Close(); }); } catch { }
            return true;
        }

        private void StartUpdateApplierScript(string targetDir, string sourceDir)
        {
            string scriptPath = Path.Combine(Path.GetTempPath(), UPDATE_SCRIPT_FILE);
            string currentExe = Application.ExecutablePath;

            string script = @"
param(
    [int]$ParentPid,
    [string]$SourceDir,
    [string]$TargetDir,
    [string]$LaunchExe
)

while (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Milliseconds 700

Get-ChildItem -Path $TargetDir -Force | ForEach-Object {
    Remove-Item -Path $_.FullName -Recurse -Force
}

Get-ChildItem -Path $SourceDir -Force | ForEach-Object {
    $destination = Join-Path $TargetDir $_.Name
    Copy-Item -Path $_.FullName -Destination $destination -Recurse -Force
}

Start-Process -FilePath $LaunchExe
";

            File.WriteAllText(scriptPath, script, Encoding.UTF8);

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = string.Format(
                "-NoProfile -ExecutionPolicy Bypass -File \"{0}\" -ParentPid {1} -SourceDir \"{2}\" -TargetDir \"{3}\" -LaunchExe \"{4}\"",
                scriptPath,
                Process.GetCurrentProcess().Id,
                sourceDir,
                targetDir,
                currentExe
            );
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            Process.Start(psi);
        }

        // ============================================================
        // EVENTO: el servidor se cerró inesperadamente
        // ============================================================
        private void ServerProcess_Exited(object sender, EventArgs e)
        {
            if (serverProcess == null || !serverReady) return;

            int exitCode = -1;
            try { exitCode = serverProcess.ExitCode; } catch { }

            if (exitCode != 0 && !this.IsDisposed)
            {
                try
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        statusLbl.Text      = "El servidor se detuvo inesperadamente";
                        statusLbl.ForeColor = Color.FromArgb(248, 113, 113);
                        detailLbl.Text      = "Cierra esta ventana y vuelve a abrir el programa.";
                        pBar.Visible        = false;
                        startBtn.Enabled    = false;
                    });
                }
                catch { }
            }
        }

        // ============================================================
        // MOSTRAR ERROR Y RESETEAR UI PARA REINTENTO
        // ============================================================
        private void ShowError(string message)
        {
            if (this.IsDisposed) return;
            try
            {
                this.Invoke((MethodInvoker)delegate
                {
                    pBar.Visible        = false;
                    statusLbl.Text      = "Error al iniciar.";
                    statusLbl.ForeColor = Color.FromArgb(248, 113, 113);
                    detailLbl.Text      = "Ver detalle en la ventana de error";

                    MessageBox.Show(
                        message,
                        "Error — Sistema de Facturas",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );

                    // Resetear para permitir reintento
                    statusLbl.Text      = "Listo para intentar de nuevo.";
                    statusLbl.ForeColor = Color.FromArgb(150, 200, 255);
                    detailLbl.Text      = "";
                    startBtn.Text       = "INICIAR SISTEMA";
                    startBtn.BackColor  = Color.FromArgb(99, 102, 241);
                    startBtn.Enabled    = true;
                });
            }
            catch { }
        }

        // ============================================================
        // EVENTO: cerrar ventana → matar el servidor
        // ============================================================
        private void LoaderForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            // Matar el proceso del servidor
            if (serverProcess != null && !serverProcess.HasExited)
            {
                try { serverProcess.Kill(); } catch { }
            }

            // Liberar el puerto (por si acaso)
            Thread killThread = new Thread(delegate() { KillProcessOnPort(activePort); });
            killThread.IsBackground = true;
            killThread.Start();
        }

        // ============================================================
        // ENTRY POINT
        // ============================================================
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Handler global para excepciones no controladas del hilo UI
            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
            {
                MessageBox.Show(
                    "Error inesperado:\n\n" + e.Exception.Message,
                    "Sistema de Facturas — Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            };

            // Handler para excepciones en otros hilos
            AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
            {
                string msg = (e.ExceptionObject is Exception)
                    ? ((Exception)e.ExceptionObject).Message
                    : e.ExceptionObject.ToString();

                MessageBox.Show(
                    "Error critico:\n\n" + msg,
                    "Sistema de Facturas — Error Fatal",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            };

            Application.Run(new LoaderForm());
        }
    }
}
