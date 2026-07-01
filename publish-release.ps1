param (
    [string]$Notes = "System update"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   AUTOMATIC GITHUB RELEASER  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check GitHub CLI
try {
    $ghVersion = gh --version
} catch {
    Write-Host "Error: 'gh' (GitHub CLI) not found." -ForegroundColor Red
    Write-Host "Please install it from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "Then open a console and run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# 2. Read version
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$Version = "v" + $pkg.version

Write-Host "`n[1/3] Preparing publication for version: $Version" -ForegroundColor Yellow

# 3. Compile
Write-Host "`n[2/3] Building the executable..." -ForegroundColor Yellow
.\build-portable.ps1

if (-not (Test-Path "Facturas_Produccion.exe")) {
    Write-Host "Error: Could not generate Facturas_Produccion.exe" -ForegroundColor Red
    exit 1
}

# 4. Upload to GitHub
Write-Host "`n[3/3] Uploading to GitHub Releases..." -ForegroundColor Yellow
try {
    # Check if release exists
    $releaseExists = gh release view $Version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Version $Version already exists in GitHub. Overwriting file." -ForegroundColor DarkYellow
        gh release upload $Version "Facturas_Produccion.exe" --clobber
    } else {
        gh release create $Version "Facturas_Produccion.exe" --title "Update $Version" --notes $Notes
    }
    
    Write-Host "`n=============================================" -ForegroundColor Cyan
    Write-Host " [OK] UPDATE PUBLISHED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host " Your clients will receive this version ($Version) automatically." -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
} catch {
    Write-Host "Error uploading to GitHub. Make sure you are logged in (gh auth login)." -ForegroundColor Red
}
