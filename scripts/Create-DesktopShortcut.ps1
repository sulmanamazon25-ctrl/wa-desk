# Creates a Desktop shortcut that launches the app with the correct working directory.
# Run once:  Right-click -> "Run with PowerShell"  OR from project folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\Create-DesktopShortcut.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherBat = Join-Path $projectRoot "Launch-WhatsApp-AI-Desktop.bat"

if (-not (Test-Path -LiteralPath $launcherBat)) {
  throw "Launcher not found: $launcherBat"
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "WhatsApp AI Desktop.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherBat
$shortcut.WorkingDirectory = $projectRoot
$shortcut.WindowStyle = 1
$shortcut.Description = "WhatsApp AI Desktop (Electron + Next.js)"
# Generic app icon from Windows system resources (optional)
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$shortcut.Save()

Write-Host "Shortcut created:"
Write-Host "  $shortcutPath"
Write-Host ""
Write-Host "Double-click 'WhatsApp AI Desktop' on your Desktop to start."
Write-Host "Tip: first time, edit .env in the project folder and add GROQ_API_KEY (console.groq.com)."
