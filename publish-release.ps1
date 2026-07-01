param (
    [string]$Notes = "Actualización de sistema"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   PUBLICADOR AUTOMÁTICO DE ACTUALIZACIONES  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Verificar GitHub CLI
try {
    $ghVersion = gh --version
} catch {
    Write-Host "Error: No se encontró 'gh' (GitHub CLI)." -ForegroundColor Red
    Write-Host "Debes instalarlo desde: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Luego abre la consola y ejecuta: gh auth login" -ForegroundColor Yellow
    exit 1
}

# 2. Leer versión
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$Version = "v" + $pkg.version

Write-Host "`n[1/3] Preparando publicación para la versión: $Version" -ForegroundColor Yellow

# 3. Compilar
Write-Host "`n[2/3] Construyendo el ejecutable..." -ForegroundColor Yellow
.\build-portable.ps1

if (-not (Test-Path "Facturas_Produccion.exe")) {
    Write-Host "Error: No se pudo generar Facturas_Produccion.exe" -ForegroundColor Red
    exit 1
}

# 4. Subir a GitHub
Write-Host "`n[3/3] Subiendo a GitHub Releases..." -ForegroundColor Yellow
try {
    # Check if release exists
    $releaseExists = gh release view $Version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "La versión $Version ya existe en GitHub. Se sobreescribirá el archivo." -ForegroundColor DarkYellow
        gh release upload $Version "Facturas_Produccion.exe" --clobber
    } else {
        gh release create $Version "Facturas_Produccion.exe" --title "Actualización $Version" --notes $Notes
    }
    
    Write-Host "`n=============================================" -ForegroundColor Cyan
    Write-Host " ✅ ¡ACTUALIZACIÓN PUBLICADA CON ÉXITO!" -ForegroundColor Green
    Write-Host " Tus clientes recibirán esta versión ($Version) automáticamente." -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
} catch {
    Write-Host "Error al subir a GitHub. Asegúrate de estar logueado (gh auth login)." -ForegroundColor Red
}
