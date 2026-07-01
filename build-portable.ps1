# ================================================================
# BUILD SCRIPT — Sistema de Facturas (Ejecutable Blindado)
# ================================================================
# Uso: Ejecutar desde la raíz del proyecto con PowerShell
# ================================================================

param(
    [switch]$SkipBuild,     # Omitir bun build (si ya existe .next/standalone)
    [switch]$SkipCompile,   # Omitir compilación de GUI.cs
    [switch]$SkipPackage,   # Omitir empaquetado WinRAR
    [string]$UpdateManifestUrl = "",
    [string]$UpdateDownloadUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  COMPILANDO EJECUTABLE A PRUEBA DE BALAS   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# ----------------------------------------------------------------
# 1. Detectar compilador C# (prioridad: .NET 4.8 > 4.7 > 4.6 > 4.0)
# ----------------------------------------------------------------
Write-Host "`n[1/4] Buscando compilador C#..." -ForegroundColor Yellow

$cscCandidates = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $null
foreach ($c in $cscCandidates) {
    if (Test-Path $c) { $csc = $c; break }
}

if (-not $csc) {
    Write-Host "❌ ERROR: No se encontró csc.exe (.NET Framework)" -ForegroundColor Red
    Write-Host "   Instala .NET Framework 4.x desde: https://dotnet.microsoft.com/download/dotnet-framework"
    exit 1
}
Write-Host "   ✅ Compilador: $csc" -ForegroundColor Green

# ----------------------------------------------------------------
# 2. Compilar GUI.cs como Windows Application (sin consola)
# ----------------------------------------------------------------
if (-not $SkipCompile) {
    Write-Host "`n[2/4] Compilando interfaz gráfica..." -ForegroundColor Yellow
    
    $compileArgs = @(
        "/target:winexe",
        "/out:FacturasPortable\SistemaFacturas.exe",
        "/r:System.Windows.Forms.dll",
        "/r:System.Drawing.dll",
        "/r:System.dll",
        "/r:System.Net.dll",
        "/r:System.Net.Sockets.dll",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.Web.Extensions.dll",
        "FacturasPortable\GUI.cs"
    )
    
    $result = Start-Process -FilePath $csc -ArgumentList $compileArgs -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -ne 0) {
        Write-Host "❌ ERROR: La compilación de GUI.cs falló (código $($result.ExitCode))" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ SistemaFacturas.exe compilado correctamente." -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Compilación de GUI omitida (--SkipCompile)." -ForegroundColor Gray
}

# ----------------------------------------------------------------
# 3. Verificar que el build de Next.js está listo
# ----------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "`n[3/4] Verificando build de Next.js..." -ForegroundColor Yellow
    
    if (-not (Test-Path ".next\standalone\server.js")) {
        Write-Host "   Build no encontrado. Ejecutando 'bun run build'..." -ForegroundColor Yellow
        & bun run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ ERROR: El build de Next.js falló." -ForegroundColor Red
            exit 1
        }
        
        # Copiar archivos estáticos al standalone
        if (Test-Path ".next\static")  { Copy-Item ".next\static"  -Destination ".next\standalone\.next\static"  -Recurse -Force }
        if (Test-Path "public")        { Copy-Item "public"         -Destination ".next\standalone\public"         -Recurse -Force }
        
        # Copiar el server.js al directorio app/ de FacturasPortable
        if (-not (Test-Path "FacturasPortable\app")) { New-Item -ItemType Directory -Path "FacturasPortable\app" -Force | Out-Null }
        Copy-Item ".next\standalone\server.js" -Destination "FacturasPortable\app\server.js" -Force
        Write-Host "   ✅ Build completado y archivos copiados." -ForegroundColor Green
    } else {
        Write-Host "   ✅ Build existente encontrado." -ForegroundColor Green
        
        # Asegurarse de que server.js esté en FacturasPortable\app
        if (-not (Test-Path "FacturasPortable\app\server.js")) {
            if (-not (Test-Path "FacturasPortable\app")) { New-Item -ItemType Directory -Path "FacturasPortable\app" -Force | Out-Null }
            Copy-Item ".next\standalone\server.js" -Destination "FacturasPortable\app\server.js" -Force
            Write-Host "   ✅ server.js sincronizado a FacturasPortable\app." -ForegroundColor Green
        }
    }
    
    # Copiar node_modules del standalone si existen
    if (Test-Path ".next\standalone\node_modules") {
        if (-not (Test-Path "FacturasPortable\app\node_modules")) {
            Write-Host "   Copiando node_modules del standalone..." -ForegroundColor Yellow
            Copy-Item ".next\standalone\node_modules" -Destination "FacturasPortable\app\node_modules" -Recurse -Force
        }
    }

    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version

    $updateConfig = @{
        current_version = $currentVersion
        manifest_url    = $UpdateManifestUrl
    }
    $updateConfig | ConvertTo-Json -Depth 4 | Set-Content -Path "FacturasPortable\update-config.json" -Encoding UTF8

    $versionManifest = @{
        version      = $currentVersion
        download_url = $UpdateDownloadUrl
    }
    $versionManifest | ConvertTo-Json -Depth 4 | Set-Content -Path "version.json" -Encoding UTF8

    if (-not [string]::IsNullOrWhiteSpace($UpdateDownloadUrl)) {
        $portableZip = "update.zip"
        if (Test-Path $portableZip) { Remove-Item $portableZip -Force }
        Compress-Archive -Path "FacturasPortable\*" -DestinationPath $portableZip -Force
        Write-Host "   ✅ ZIP de actualización generado: $portableZip" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  No se generó update.zip porque faltó -UpdateDownloadUrl." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[3/4] Build de Next.js omitido (--SkipBuild)." -ForegroundColor Gray
}

# ----------------------------------------------------------------
# 4. Empaquetar con WinRAR SFX
# ----------------------------------------------------------------
if (-not $SkipPackage) {
    Write-Host "`n[4/4] Empaquetando en Facturas_Produccion.exe..." -ForegroundColor Yellow
    
    $winrar = "C:\Program Files\WinRAR\WinRAR.exe"
    if (-not (Test-Path $winrar)) {
        $winrar = "C:\Program Files (x86)\WinRAR\WinRAR.exe"
    }
    
    if (-not (Test-Path $winrar)) {
        Write-Host "❌ ERROR: No se encontró WinRAR." -ForegroundColor Red
        Write-Host "   Instálalo desde https://www.rarlab.com o pasa la carpeta FacturasPortable directamente."
        exit 1
    }
    
    # Actualizar sfx-config.txt
    $sfxConfig = @"
Setup=FacturasPortable\SistemaFacturas.exe
TempMode
Silent=1
Overwrite=1
"@
    Set-Content -Path "sfx-config.txt" -Value $sfxConfig -Encoding UTF8
    
    # Eliminar versión anterior
    if (Test-Path "Facturas_Produccion.exe") { Remove-Item "Facturas_Produccion.exe" -Force }
    
    $rarArgs = "a -r -ep1 -sfx -z`"sfx-config.txt`" `"Facturas_Produccion.exe`" `"FacturasPortable`""
    $result = Start-Process -FilePath $winrar -ArgumentList $rarArgs -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -ne 0 -and $result.ExitCode -ne 1) {
        Write-Host "❌ ERROR: WinRAR falló (código $($result.ExitCode))" -ForegroundColor Red
        exit 1
    }
    
    $exeSize = [math]::Round((Get-Item "Facturas_Produccion.exe").Length / 1MB, 1)
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host "  ✅  EJECUTABLE LISTO: Facturas_Produccion.exe ($exeSize MB)" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Instrucciones para el usuario final:" -ForegroundColor White
    Write-Host "  • Hacer DOBLE CLIC en Facturas_Produccion.exe" -ForegroundColor White
    Write-Host "  • Esperar que aparezca la ventana del sistema" -ForegroundColor White
    Write-Host "  • Hacer clic en el botón INICIAR SISTEMA" -ForegroundColor White
    Write-Host "  • El sistema abrirá el navegador automáticamente cuando esté listo" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "`n[4/4] Empaquetado omitido (--SkipPackage)." -ForegroundColor Gray
}
