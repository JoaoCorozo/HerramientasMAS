$ErrorActionPreference = "Stop"

$RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$LogsDir = Join-Path $RootDir "logs"
$LogPath = Join-Path $LogsDir "inicio.log"
$ServerPath = Join-Path $PSScriptRoot "server.ps1"
$WorkerPath = Join-Path $PSScriptRoot "worker.ps1"
$SelectFilesPath = Join-Path $PSScriptRoot "select-files.ps1"
$PrimaryPort = 8787
$Ports = 8787..8797
$PrimaryUrl = "http://localhost:$PrimaryPort/"
$MaxWaitMs = 12000
$PollMs = 250

if (-not (Test-Path -LiteralPath $LogsDir)) {
    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
}

function Add-StartLog {
    param([string]$Text)
    $line = "{0} {1}" -f (Get-Date).ToString("s"), $Text
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Open-StartLog {
    try { Start-Process -FilePath "notepad.exe" -ArgumentList $LogPath } catch {}
}

function Test-PortOpen {
    param([int]$Port)

    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(50, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        if ($client) { $client.Close() }
    }
}

function Get-FirstOpenUrl {
    foreach ($port in $Ports) {
        if (Test-PortOpen $port) {
            return "http://localhost:$port/"
        }
    }
    return $null
}

function Test-DirWritable {
    param([string]$Dir)
    if (-not (Test-Path -LiteralPath $Dir)) {
        try {
            New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        } catch {
            return $false
        }
    }
    try {
        $probe = Join-Path $Dir (".write_check_" + [guid]::NewGuid().ToString("N"))
        [System.IO.File]::WriteAllText($probe, "ok")
        Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
        return $true
    } catch {
        return $false
    }
}

Add-StartLog "======================================="
Add-StartLog "Inicio solicitado."
Add-StartLog ("Ruta proyecto: {0}" -f $RootDir)
Add-StartLog ("Usuario Windows: {0}" -f [System.Security.Principal.WindowsIdentity]::GetCurrent().Name)

$policy = ""
try { $policy = (Get-ExecutionPolicy -Scope CurrentUser -ErrorAction SilentlyContinue).ToString() } catch {}
Add-StartLog ("ExecutionPolicy (CurrentUser): {0}" -f $policy)

# Desbloquear archivos PS1 si fueron descargados de internet (Zone.Identifier)
foreach ($psFile in @($ServerPath, $WorkerPath, $SelectFilesPath, (Join-Path $PSScriptRoot "iniciar_compresor.ps1"))) {
    if (Test-Path -LiteralPath $psFile -PathType Leaf) {
        try { Unblock-File -Path $psFile -ErrorAction SilentlyContinue } catch {}
    }
}

# Verificar FFmpeg
$FfmpegPath = Join-Path $RootDir "bin\ffmpeg.exe"
$ffmpegOk = Test-Path -LiteralPath $FfmpegPath
$ffmpegLabel = if ($ffmpegOk) { "SI" } else { "NO" }
Add-StartLog ("FFmpeg encontrado: $ffmpegLabel - $FfmpegPath")

if ($ffmpegOk) {
    try { Unblock-File -Path $FfmpegPath -ErrorAction SilentlyContinue } catch {}
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $FfmpegPath
        $psi.Arguments = "-version"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        [void]$proc.Start()
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
        [void]$proc.WaitForExit(5000)
        if (-not $proc.HasExited) { try { $proc.Kill() } catch {} }
        $vOut = ""
        try { $vOut = $outTask.Result } catch {}
        try { if ([string]::IsNullOrEmpty($vOut)) { $vOut = $errTask.Result } } catch {}
        if ($vOut -match "ffmpeg version ([^\s]+)") {
            Add-StartLog ("FFmpeg version: {0}" -f $Matches[1])
        } else {
            Add-StartLog "ADVERTENCIA: FFmpeg encontrado pero no responde a -version. Puede estar bloqueado por antivirus o seguridad de Windows."
        }
    } catch {
        Add-StartLog ("ADVERTENCIA: no se pudo ejecutar FFmpeg para verificar version: {0}" -f $_.Exception.Message)
    }
}

# Verificar plantilla
$TemplateDir = Join-Path $RootDir "carpeta para el video"
$templateOk = Test-Path -LiteralPath (Join-Path $TemplateDir "index.html")
$templateLabel = if ($templateOk) { "SI" } else { "NO - falta carpeta para el video\index.html" }
Add-StartLog ("Plantilla de video OK: $templateLabel")

# Verificar todas las carpetas internas con prueba de escritura
$dirsToCheck = @(
    @{ Name = "logs";             Path = (Join-Path $RootDir "logs") },
    @{ Name = "temp";             Path = (Join-Path $RootDir "temp") },
    @{ Name = "temp\jobs";        Path = (Join-Path $RootDir "temp\jobs") },
    @{ Name = "temp\processing";  Path = (Join-Path $RootDir "temp\processing") },
    @{ Name = "temp\paquetes";    Path = (Join-Path $RootDir "temp\paquetes") },
    @{ Name = "output";           Path = (Join-Path $RootDir "output") }
)

$anyDirError = $false
foreach ($d in $dirsToCheck) {
    $ok = Test-DirWritable $d.Path
    $label = if ($ok) { "OK" } else { "ERROR - sin permiso de escritura" }
    Add-StartLog ("{0}: {1} - {2}" -f $d.Name, $label, $d.Path)
    if (-not $ok) { $anyDirError = $true }
}

if ($anyDirError) {
    Add-StartLog "ADVERTENCIA: una o mas carpetas internas no tienen permiso de escritura. La app puede fallar."
}

# Errores criticos que impiden iniciar
if (-not $ffmpegOk) {
    Add-StartLog "ERROR CRITICO: FFmpeg no encontrado. La compresion no funcionara."
    Add-StartLog "Coloca ffmpeg.exe en: $FfmpegPath"
    Open-StartLog
    exit 1
}

# Verificar si el servidor ya está activo
$existingUrl = Get-FirstOpenUrl
if ($existingUrl) {
    Add-StartLog ("Servidor ya activo en: {0}" -f $existingUrl)
    Start-Process $existingUrl
    exit 0
}

if (-not (Test-Path -LiteralPath $ServerPath -PathType Leaf)) {
    Add-StartLog ("ERROR: no existe el archivo backend: {0}" -f $ServerPath)
    Open-StartLog
    exit 1
}

try {
    $env:COMPRESOR_NO_BROWSER = "1"
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ServerPath)
    Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $RootDir -WindowStyle Hidden | Out-Null
    Add-StartLog "Backend iniciado en segundo plano. Esperando puerto..."
} catch {
    Add-StartLog ("ERROR: no se pudo iniciar el backend: {0}" -f $_.Exception.Message)
    Add-StartLog "Posible causa: Windows o el antivirus esta bloqueando PowerShell o el archivo .ps1."
    Add-StartLog ("Revisa si los archivos .ps1 estan bloqueados con: Get-Item {0} -Stream Zone.Identifier" -f $ServerPath)
    Open-StartLog
    exit 1
}

$deadline = (Get-Date).AddMilliseconds($MaxWaitMs)
$attempt = 1

while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $PrimaryPort) {
        Add-StartLog ("Servidor listo en intento {0}." -f $attempt)
        Start-Process $PrimaryUrl
        exit 0
    }
    $attempt++
    Start-Sleep -Milliseconds $PollMs
}

Add-StartLog "ERROR: el servidor no respondio en $($MaxWaitMs / 1000) segundos."
Add-StartLog "Posibles causas:"
Add-StartLog "  - Antivirus bloqueando PowerShell o FFmpeg"
Add-StartLog "  - Archivos .ps1 bloqueados por seguridad de Windows (Zone.Identifier)"
Add-StartLog "  - Puerto $PrimaryPort ocupado por otro proceso"
Add-StartLog "  - Error interno en server.ps1 (revisa logs\app.log)"
Add-StartLog "Sugerencia: ejecuta diagnostico_compresor.bat para obtener un reporte completo."
Open-StartLog
exit 1
