param (
    [switch]$SkipBuild,
    [switch]$SkipCompile,
    [switch]$SkipPackage
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  COMPILANDO EJECUTABLE A PRUEBA DE BALAS   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 0. Generar Icono Zemer (Z morada oscuro en fondo blanco)
Write-Host "`n[0/5] Generando icono Zemer..." -ForegroundColor Yellow
$code = @"
using System.Drawing;
using System.IO;
public class IconMaker {
    public static void MakeIcon() {
        using (Bitmap bmp = new Bitmap(256, 256))
        using (Graphics g = Graphics.FromImage(bmp)) {
            g.Clear(Color.White);
            using (Font font = new Font("Arial", 160, FontStyle.Bold))
            using (SolidBrush brush = new SolidBrush(Color.FromArgb(48, 25, 52))) {
                StringFormat sf = new StringFormat();
                sf.Alignment = StringAlignment.Center;
                sf.LineAlignment = StringAlignment.Center;
                g.DrawString("Z", font, brush, new RectangleF(0, 0, 256, 256), sf);
            }
            using (FileStream fs = new FileStream("zemer.ico", FileMode.Create)) {
                Icon.FromHandle(bmp.GetHicon()).Save(fs);
            }
        }
    }
}
"@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[IconMaker]::MakeIcon()
Write-Host "✅ Icono zemer.ico generado." -ForegroundColor Green

# 1. Compilar C#
if (-not $SkipCompile) {
    Write-Host "`n[1/4] Buscando compilador C#..." -ForegroundColor Yellow
    $csc = "$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    
    if (-not (Test-Path $csc)) {
        $csc = "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    }
    
    if (-not (Test-Path $csc)) {
        Write-Host "Error: No se encontró csc.exe. Requiere .NET Framework 4.0 instalado." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Compilador: $csc" -ForegroundColor Green
    
    $compileArgs = @(
        "/target:winexe",
        "/out:FacturasPortable\SistemaFacturas.exe",
        "/win32icon:zemer.ico",
        "/r:System.Windows.Forms.dll",
        "/r:System.Drawing.dll",
        "/r:System.dll",
        "/r:System.Net.dll",
        "/r:System.Net.Http.dll",
        "FacturasPortable\GUI.cs"
    )
    
    $result = Start-Process -FilePath $csc -ArgumentList $compileArgs -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -ne 0) {
        Write-Host "Error en la compilación de GUI.cs" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ GUI compilada exitosamente." -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Compilación de GUI omitida (--SkipCompile)." -ForegroundColor DarkGray
}

# 2. Build de Next.js
if (-not $SkipBuild) {
    Write-Host "`n[3/4] Compilando Next.js standalone..." -ForegroundColor Yellow
    
    # Hacer el build
    $bunPath = "bun"
    $result = Start-Process -FilePath $bunPath -ArgumentList "run","build" -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -ne 0) {
        Write-Host "Error en el build de Next.js" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Build generado. Sincronizando archivos..." -ForegroundColor Green
    
    # Copiar archivos
    if (Test-Path ".next\static")  { Copy-Item ".next\static" -Destination ".next\standalone\.next\static" -Recurse -Force }
    if (Test-Path "public")        { Copy-Item "public"       -Destination ".next\standalone\public"       -Recurse -Force }
    
    # Mover standalone a FacturasPortable\app
    if (Test-Path "FacturasPortable\app") { Remove-Item "FacturasPortable\app" -Recurse -Force }
    Move-Item ".next\standalone" "FacturasPortable\app" -Force
    
    # Copiar prisma para tener la base de datos inicial
    Copy-Item "prisma" -Destination "FacturasPortable\app\prisma" -Recurse -Force
    
    # Descargar node.exe portable para no depender de Node.js instalado (renombrado para aislarlo)
    $nodePath = "FacturasPortable\node_zemer.exe"
    if (-not (Test-Path $nodePath)) {
        Write-Host "Descargando node.exe portable..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.17.0/win-x64/node.exe" -OutFile $nodePath
        Write-Host "✅ node_zemer.exe descargado." -ForegroundColor Green
    }
    
    # Cambiar el icono de node_zemer.exe
    $rceditPath = "rcedit.exe"
    if (-not (Test-Path $rceditPath)) {
        Write-Host "Descargando rcedit para modificar el icono de node..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe" -OutFile $rceditPath
    }
    if (Test-Path $rceditPath) {
        Write-Host "Aplicando icono Zemer a node_zemer.exe..." -ForegroundColor Yellow
        Start-Process -FilePath $rceditPath -ArgumentList "`"FacturasPortable\node_zemer.exe`" --set-icon `"zemer.ico`"" -Wait -NoNewWindow
    }
    
    # Eliminar app local antigua si la renombramos sin mover
    if (Test-Path "app") { Remove-Item "app" -Recurse -Force }
} else {
    Write-Host "`n[3/4] Build de Next.js omitido (--SkipBuild)." -ForegroundColor DarkGray
}

# 3. Empaquetar
if (-not $SkipPackage) {
    Write-Host "`n[4/4] Empaquetando en Facturas_Produccion.exe..." -ForegroundColor Yellow
    
    $winrar = "C:\Program Files\WinRAR\WinRAR.exe"
    if (-not (Test-Path $winrar)) {
        Write-Host "Error: No se encontró WinRAR en $winrar." -ForegroundColor Red
        exit 1
    }
    
    if (Test-Path "Facturas_Produccion.exe") {
        Remove-Item "Facturas_Produccion.exe" -Force
    }
    
    # Leer la versión desde package.json para el sistema de actualizaciones
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    $AppVersion = "v" + $pkg.version
    Set-Content -Path "FacturasPortable\version.txt" -Value $AppVersion -Encoding UTF8
    Write-Host "✅ Empaquetando versión: $AppVersion" -ForegroundColor Green

    # Crear SFX conf
    $sfxConf = @"
Path=%APPDATA%\SistemaFacturas
Presetup=cmd.exe /c "taskkill /F /IM SistemaFacturas.exe /T >nul 2>&1 & taskkill /F /IM bun.exe /T >nul 2>&1 & taskkill /F /IM node_zemer.exe /T >nul 2>&1"
Setup=SistemaFacturas.exe
Silent=2
Overwrite=1
Update=U
Title=Sistema de Facturas
"@
    Set-Content -Path "sfx_config.txt" -Value $sfxConf -Encoding UTF8

    $rarArgs = @("a", "-sfx", "-z`"sfx_config.txt`"", "-iiconzemer.ico", "-ep1", "-r", "Facturas_Produccion.exe", "FacturasPortable\*")
    
    $result = Start-Process -FilePath $winrar -ArgumentList $rarArgs -Wait -NoNewWindow -PassThru
    
    if (Test-Path "sfx_config.txt") { Remove-Item "sfx_config.txt" -Force }
    
    if ($result.ExitCode -eq 0 -or $result.ExitCode -eq 1) {
        Write-Host "`n=============================================" -ForegroundColor Cyan
        Write-Host "  ✅ EJECUTABLE LISTO: Facturas_Produccion.exe" -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Cyan
        
        Write-Host "`n[5/5] Añadiendo firma de seguridad (Zemer)..." -ForegroundColor Yellow
        try {
            $cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -match "CN=Zemer" } | Select-Object -First 1
            if (-not $cert) {
                $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Zemer" -FriendlyName "Zemer Signature" -CertStoreLocation "Cert:\CurrentUser\My" -ErrorAction Stop
            }
            Set-AuthenticodeSignature -FilePath "Facturas_Produccion.exe" -Certificate $cert -TimestampServer "http://timestamp.digicert.com" -ErrorAction Stop
            Write-Host "✅ Ejecutable firmado como Editor: Zemer." -ForegroundColor Green
        } catch {
            Write-Host "⚠ No se pudo firmar el ejecutable, pero el archivo es funcional." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "Hubo un error al empaquetar con WinRAR. Codigo: $($result.ExitCode)" -ForegroundColor Red
    }
}