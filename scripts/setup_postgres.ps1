$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgDir = Join-Path $workspaceRoot "pgsql"
$dataDir = Join-Path $pgDir "data"
$logFile = Join-Path $pgDir "logfile.log"
$zipPg = Join-Path $workspaceRoot "postgresql-16.8-binaries.zip"
$zipVector = Join-Path $workspaceRoot "vector.v0.8.6-pg16.zip"

Write-Host "=== Setting up Portable PostgreSQL 16 with pgvector ==="

# 1. Download PostgreSQL 16 binaries if not already extracted
if (-not (Test-Path (Join-Path $pgDir "bin\postgres.exe"))) {
    if (-not (Test-Path $zipPg)) {
        Write-Host "Downloading PostgreSQL 16.8 binaries from EnterpriseDB..."
        Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-16.8-1-windows-x64-binaries.zip" -OutFile $zipPg -UseBasicParsing
    }
    Write-Host "Extracting PostgreSQL binaries..."
    Expand-Archive -Path $zipPg -DestinationPath $workspaceRoot -Force
} else {
    Write-Host "PostgreSQL binaries already present in $pgDir."
}

# 2. Download and install pgvector extension binaries
$vectorDll = Join-Path $pgDir "lib\vector.dll"
if (-not (Test-Path $vectorDll)) {
    if (-not (Test-Path $zipVector)) {
        Write-Host "Downloading pgvector v0.8.6 for PG16..."
        Invoke-WebRequest -Uri "https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/0.8.6_16/vector.v0.8.6-pg16.zip" -OutFile $zipVector -UseBasicParsing
    }
    Write-Host "Extracting pgvector extension files..."
    $tempVectorDir = Join-Path $workspaceRoot "temp_vector"
    if (Test-Path $tempVectorDir) { Remove-Item -Recurse -Force $tempVectorDir }
    Expand-Archive -Path $zipVector -DestinationPath $tempVectorDir -Force

    # Copy files according to pgvector layout
    # vector.dll -> lib/
    # vector.control, vector--*.sql -> share/extension/
    Get-ChildItem -Path $tempVectorDir -Recurse -Filter "vector.dll" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $pgDir "lib") -Force
        Write-Host "Installed: $($_.Name) -> lib/"
    }
    Get-ChildItem -Path $tempVectorDir -Recurse -Filter "vector*" | Where-Object { $_.Name -ne "vector.dll" } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $pgDir "share\extension") -Force
        Write-Host "Installed: $($_.Name) -> share/extension/"
    }
    Remove-Item -Recurse -Force $tempVectorDir
} else {
    Write-Host "pgvector extension files already installed."
}

# 3. Initialize database cluster if data directory does not exist
$initDb = Join-Path $pgDir "bin\initdb.exe"
if (-not (Test-Path $dataDir)) {
    Write-Host "Initializing database cluster in $dataDir..."
    & $initDb -D $dataDir -U postgres -A trust -E UTF8
} else {
    Write-Host "Database cluster already initialized at $dataDir."
}

# 4. Start PostgreSQL server
$pgCtl = Join-Path $pgDir "bin\pg_ctl.exe"
Write-Host "Starting PostgreSQL server..."
& $pgCtl -D $dataDir -l $logFile start

Start-Sleep -Seconds 2

# 5. Create database veriai and enable vector extension
$psql = Join-Path $pgDir "bin\psql.exe"
Write-Host "Configuring veriai database..."
& $psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'veriai'" | Out-Null
& $psql -U postgres -c "CREATE DATABASE veriai;" -ErrorAction SilentlyContinue

Write-Host "Enabling vector extension on veriai database..."
& $psql -U postgres -d veriai -c "CREATE EXTENSION IF NOT EXISTS vector;"

Write-Host "Verifying pgvector extension:"
& $psql -U postgres -d veriai -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"

Write-Host "=== PostgreSQL + pgvector setup completed successfully! ==="
