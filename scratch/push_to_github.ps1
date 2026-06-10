# push_to_github.ps1
# This script initializes Git, commits the codebase, and pushes it to your GitHub repository.

$workspace = "c:\Users\ASUS\Desktop\pgp"
Set-Location $workspace

# Check if git is available
$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    # Check if Git is in PATH
    $gitVer = git --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Search winget default paths or restart shell environment PATH
        $env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
    }
}

# 1. Initialize git
if (-not (Test-Path "$workspace\.git")) {
    git init
    Write-Host "Git repository initialized." -ForegroundColor Green
}

# 2. Add gitignore if missing
if (-not (Test-Path "$workspace\.gitignore")) {
    Set-Content -Path "$workspace\.gitignore" -Value @"
node_modules/
scratch/node-portable/
database.sqlite
.env
*.log
"@
    Write-Host ".gitignore created."
}

# 3. Add files and commit
git add .
git commit -m "Initial commit with email notifications and SQLite support"
git branch -M main
Write-Host "Code committed locally to 'main' branch." -ForegroundColor Green

# 4. Prompt user for GitHub Repo URL
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Local Git repository prepared successfully!" -ForegroundColor Green
Write-Host "Now, please create a new, BLANK repository on GitHub" -ForegroundColor Yellow
Write-Host "(e.g., at https://github.com/new)" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

$repoUrl = Read-Host "Paste your GitHub repository URL (e.g., https://github.com/username/repo.git)"

if ($repoUrl) {
    git remote remove origin 2>$null
    git remote add origin $repoUrl
    Write-Host "Pushing code to GitHub..." -ForegroundColor Cyan
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "Code pushed to GitHub successfully!" -ForegroundColor Green
        Write-Host "Please let me know your repository URL in the chat," -ForegroundColor Yellow
        Write-Host "and I will automatically deploy it to Render for you!" -ForegroundColor Yellow
        Write-Host "==================================================" -ForegroundColor Green
    } else {
        Write-Host "Error pushing code. Make sure you are logged in to Git on your computer." -ForegroundColor Red
    }
}
