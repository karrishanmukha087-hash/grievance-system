# run_portable.ps1
# This script downloads a self-contained portable Node.js environment, installs dependencies, and runs the server.

$workspace = "c:\Users\ASUS\Desktop\pgp"
$nodeDir = "$workspace\scratch\node-portable"
$zipPath = "$workspace\scratch\node.zip"
$nodeExe = "$nodeDir\node-v20.11.1-win-x64\node.exe"
$npmCmd = "$nodeDir\node-v20.11.1-win-x64\npm.cmd"

# 1. Download and Extract Node.js if not already present
if (-not (Test-Path $nodeExe)) {
    Write-Host "---------------------------------------------------"
    Write-Host "Downloading portable Node.js v20.11.1 (Windows x64)..."
    Write-Host "---------------------------------------------------"
    
    if (-not (Test-Path "$workspace\scratch")) {
        New-Item -ItemType Directory -Path "$workspace\scratch" | Out-Null
    }
    
    $url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    
    Write-Host "Extracting archive to: $nodeDir..."
    Expand-Archive -Path $zipPath -DestinationPath $nodeDir
    
    # Clean up zip
    if (Test-Path $zipPath) {
        Remove-Item $zipPath
    }
    Write-Host "Node.js extracted successfully."
}

# 2. Install dependencies
Write-Host "---------------------------------------------------"
Write-Host "Installing dependencies using portable npm..."
Write-Host "---------------------------------------------------"
Set-Location $workspace
& $npmCmd install

# 3. Launch server
Write-Host "---------------------------------------------------"
Write-Host "Starting Citizen Grievance Portal Express Server..."
Write-Host "---------------------------------------------------"
& $nodeExe server.js
