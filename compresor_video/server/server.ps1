$ErrorActionPreference = "Stop"

$RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$AppDir = Join-Path $RootDir "app"
$BinDir = Join-Path $RootDir "bin"
$InputDir = Join-Path $RootDir "input"
$OutputDir = Join-Path $RootDir "output"
$TempDir = Join-Path $RootDir "temp"
$JobsDir = Join-Path $TempDir "jobs"
$ProcessingDir = Join-Path $TempDir "processing"
$PackagesDir = Join-Path $TempDir "paquetes"
$LogsDir = Join-Path $RootDir "logs"
$AppLogPath = Join-Path $LogsDir "app.log"
$WorkerPath = Join-Path $PSScriptRoot "worker.ps1"
$SelectFilesPath = Join-Path $PSScriptRoot "select-files.ps1"
$FfmpegPath = Join-Path $BinDir "ffmpeg.exe"
$TemplateDir = Join-Path $RootDir "carpeta para el video"

foreach ($dir in @($AppDir, $BinDir, $InputDir, $OutputDir, $TempDir, $JobsDir, $ProcessingDir, $PackagesDir, $LogsDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

foreach ($f in @(Get-ChildItem -LiteralPath $ProcessingDir -File -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
}
foreach ($f in @(Get-ChildItem -LiteralPath $JobsDir -File -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
}
foreach ($d in @(Get-ChildItem -LiteralPath $PackagesDir -Directory -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

$script:Items = [ordered]@{}
$script:QueueStartedAt = $null
$script:QueueFinishedAt = $null
$script:CancelRequested = $false
$script:StartedAt = Get-Date
$script:LastHeartbeatAt = Get-Date
$script:HasHeartbeat = $false
$script:ShutdownRequested = $false

function Add-AppLog {
    param([string]$Text)
    $line = "{0} {1}" -f (Get-Date).ToString("s"), $Text
    try { Add-Content -LiteralPath $AppLogPath -Value $line -Encoding UTF8 } catch {}
}

function New-Id {
    return ([guid]::NewGuid().ToString("N"))
}

function Get-FileSize {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return ([System.IO.FileInfo]$Path).Length
    }
    return 0
}

function ConvertTo-PlainItem {
    param($Item)
    return [ordered]@{
        id = $Item.Id
        name = $Item.Name
        path = $Item.Path
        size = $Item.Size
        status = $Item.Status
        message = $Item.Message
        progress = $Item.Progress
        output = $Item.Output
        finalSize = $Item.FinalSize
        reductionPercent = $Item.ReductionPercent
        resolution = $Item.Resolution
        source = $Item.Source
        sourceLabel = $Item.SourceLabel
        elapsedSeconds = $Item.ElapsedSeconds
        startedAt = $Item.StartedAt
        finishedAt = $Item.FinishedAt
        lms = $Item.Lms
        lmsLabel = $Item.LmsLabel
        courseId = $Item.CourseId
        zipName = $Item.ZipName
    }
}

function Quote-Argument {
    param([string]$Value)
    if ($null -eq $Value) { return '""' }
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Join-Arguments {
    param([string[]]$Arguments)
    return (($Arguments | ForEach-Object { Quote-Argument $_ }) -join " ")
}

function Get-ReasonPhrase {
    param([int]$StatusCode)
    switch ($StatusCode) {
        200 { return "OK" }
        400 { return "Bad Request" }
        403 { return "Forbidden" }
        404 { return "Not Found" }
        405 { return "Method Not Allowed" }
        500 { return "Internal Server Error" }
        default { return "OK" }
    }
}

function Send-HttpResponse {
    param($Context, [byte[]]$Body, [int]$StatusCode, [string]$ContentType)
    $client = $Context.Client
    $reason = Get-ReasonPhrase $StatusCode
    $headers = @(
        "HTTP/1.1 $StatusCode $reason",
        "Content-Type: $ContentType",
        "Content-Length: $($Body.Length)",
        "Connection: close",
        "Cache-Control: no-store",
        "",
        ""
    ) -join "`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    try {
        $stream = $client.GetStream()
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($Body.Length -gt 0) {
            $stream.Write($Body, 0, $Body.Length)
        }
        $stream.Flush()
    } catch {
        # Conexion cerrada por el cliente, se ignora
    } finally {
        try { $client.Close() } catch {}
    }
}

function Write-JsonResponse {
    param($Context, $Data, [int]$StatusCode = 200)
    $json = $Data | ConvertTo-Json -Depth 8
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-HttpResponse $Context $bytes $StatusCode "application/json; charset=utf-8"
}

function Write-TextResponse {
    param($Context, [string]$Text, [int]$StatusCode = 200, [string]$ContentType = "text/plain; charset=utf-8")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    Send-HttpResponse $Context $bytes $StatusCode $ContentType
}

function Read-RequestJson {
    param($Request)
    if (-not $Request.HasEntityBody -or [string]::IsNullOrWhiteSpace($Request.Body)) {
        return @{}
    }
    return ($Request.Body | ConvertFrom-Json)
}

function Get-MimeType {
    param([string]$Path)
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css" { return "text/css; charset=utf-8" }
        ".js" { return "application/javascript; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

function Read-HttpRequest {
    param($Client)
    $stream = $Client.GetStream()
    $buffer = New-Object byte[] 8192
    $memory = New-Object System.IO.MemoryStream
    $headerEnd = -1

    while ($headerEnd -lt 0) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { return $null }
        $memory.Write($buffer, 0, $read)
        $text = [System.Text.Encoding]::ASCII.GetString($memory.ToArray())
        $headerEnd = $text.IndexOf("`r`n`r`n")
        if ($memory.Length -gt 1048576) { throw "Solicitud HTTP demasiado grande." }
    }

    $allBytes = $memory.ToArray()
    $headerText = [System.Text.Encoding]::ASCII.GetString($allBytes, 0, $headerEnd)
    $headerBytesLength = [System.Text.Encoding]::ASCII.GetByteCount($headerText + "`r`n`r`n")
    $lines = $headerText -split "`r`n"
    $requestParts = $lines[0] -split " "
    if ($requestParts.Count -lt 2) { return $null }

    $headers = @{}
    foreach ($line in ($lines | Select-Object -Skip 1)) {
        $parts = $line -split ":", 2
        if ($parts.Count -eq 2) {
            $headers[$parts[0].Trim().ToLowerInvariant()] = $parts[1].Trim()
        }
    }

    $contentLength = 0
    if ($headers.ContainsKey("content-length")) {
        [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
    }

    $bodyMemory = New-Object System.IO.MemoryStream
    $alreadyRead = $allBytes.Length - $headerBytesLength
    if ($alreadyRead -gt 0) {
        $bodyMemory.Write($allBytes, $headerBytesLength, $alreadyRead)
    }

    while ($bodyMemory.Length -lt $contentLength) {
        $remaining = $contentLength - [int]$bodyMemory.Length
        $toRead = [Math]::Min($buffer.Length, $remaining)
        $read = $stream.Read($buffer, 0, $toRead)
        if ($read -le 0) { break }
        $bodyMemory.Write($buffer, 0, $read)
    }

    $pathOnly = (($requestParts[1]) -split "\?", 2)[0]
    $body = ""
    if ($bodyMemory.Length -gt 0) {
        $body = [System.Text.Encoding]::UTF8.GetString($bodyMemory.ToArray())
    }

    return [pscustomobject]@{
        HttpMethod = $requestParts[0]
        Url = [pscustomobject]@{ AbsolutePath = $pathOnly }
        Body = $body
        HasEntityBody = ($contentLength -gt 0)
    }
}

function ConvertTo-SafeSlug {
    param([string]$Value, [string]$Fallback = "archivo")
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Fallback }
    $normalized = $Value.Normalize([System.Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder
    foreach ($char in $normalized.ToCharArray()) {
        $category = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
        if ($category -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($char)
        }
    }
    $slug = $builder.ToString().Normalize([System.Text.NormalizationForm]::FormC).ToLowerInvariant()
    $slug = ($slug -replace "[^a-z0-9]+", "_").Trim("_")
    $slug = $slug -replace "_+", "_"
    if ([string]::IsNullOrWhiteSpace($slug)) { return $Fallback }
    return $slug
}

function Get-LmsInfo {
    param([string]$Lms)
    $enaexInglesLabel = "Enaex Ingl" + [string]([char]0x00E9) + "s"
    switch ($Lms.ToLowerInvariant()) {
        "enaex_hispano" {
            return [pscustomobject]@{
                Key = "enaex_hispano"
                Label = "Enaex Hispano"
                Slug = "enaex_hispano"
                BaseUrl = "https://enaexacademy.enaex.com/course/view.php?id="
            }
        }
        "enaex_ingles" {
            return [pscustomobject]@{
                Key = "enaex_ingles"
                Label = $enaexInglesLabel
                Slug = "enaex_ingles"
                BaseUrl = "https://enaexacademyen.enaex.com/course/view.php?id="
            }
        }
        "enaex_brasil" {
            return [pscustomobject]@{
                Key = "enaex_brasil"
                Label = "Enaex Brasil"
                Slug = "enaex_brasil"
                BaseUrl = "https://enaexacademybrasil.enaex.com/course/view.php?id="
            }
        }
        "habitat" {
            return [pscustomobject]@{
                Key = "habitat"
                Label = "Habitat"
                Slug = "habitat"
                BaseUrl = "https://personas.afphabitat.cl/course/view.php?id="
            }
        }
        "bex" {
            return [pscustomobject]@{
                Key = "bex"
                Label = "BEX"
                Slug = "bex"
                BaseUrl = "https://www.gestiondepersonasbex.cl/course/view.php?id="
            }
        }
        "banco_internacional" {
            return [pscustomobject]@{
                Key = "banco_internacional"
                Label = "Banco Internacional"
                Slug = "banco_internacional"
                BaseUrl = "https://plataformaavanza.interconecta2.cl/course/view.php?id="
            }
        }
        "transelec" {
            return [pscustomobject]@{
                Key = "transelec"
                Label = "Transelec"
                Slug = "transelec"
                BaseUrl = "https://www.portalaprende.com/course/view.php?id="
            }
        }
        "aza" {
            return [pscustomobject]@{
                Key = "aza"
                Label = "AZA"
                Slug = "aza"
                BaseUrl = "https://www.azacapacita.cl/course/view.php?id="
            }
        }
        "carozzi" {
            return [pscustomobject]@{
                Key = "carozzi"
                Label = "Carozzi"
                Slug = "carozzi"
                BaseUrl = "https://micamino.carozzicorp.com/course/view.php?id="
            }
        }
        default { return $null }
    }
}

function Test-PackageTemplate {
    $warnings = @()
    if (-not (Test-Path -LiteralPath $TemplateDir -PathType Container)) {
        return [pscustomobject]@{ Ok = $false; Error = "No existe la carpeta plantilla: carpeta para el video."; Warning = "" }
    }
    $content = @(Get-ChildItem -LiteralPath $TemplateDir -Force -ErrorAction SilentlyContinue)
    if ($content.Count -eq 0) {
        return [pscustomobject]@{ Ok = $false; Error = "La carpeta plantilla esta vacia."; Warning = "" }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $TemplateDir "index.html") -PathType Leaf)) {
        return [pscustomobject]@{ Ok = $false; Error = "La plantilla debe incluir index.html."; Warning = "" }
    }
    foreach ($folder in @("css", "font", "js")) {
        if (-not (Test-Path -LiteralPath (Join-Path $TemplateDir $folder) -PathType Container)) {
            $warnings += "No se encontro la carpeta $folder en la plantilla."
        }
    }
    return [pscustomobject]@{ Ok = $true; Error = ""; Warning = ($warnings -join " ") }
}

function Get-SafeZipOutputPath {
    param([string]$InputPath, [int]$Height, [string]$Lms, [string]$CourseId)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
    $cleanName = ConvertTo-SafeSlug $baseName "video"
    $lmsInfo = Get-LmsInfo $Lms
    $cleanLms = if ($lmsInfo) { $lmsInfo.Slug } else { ConvertTo-SafeSlug $Lms "lms" }
    $cleanCourse = (($CourseId) -replace "[^0-9]", "")
    $stem = "{0}_{1}_curso_{2}_{3}p" -f $cleanName, $cleanLms, $cleanCourse, $Height
    $candidate = Join-Path $OutputDir ($stem + ".zip")
    $counter = 2
    while (Test-Path -LiteralPath $candidate) {
        $candidate = Join-Path $OutputDir ("{0}_{1}.zip" -f $stem, $counter)
        $counter++
    }
    return $candidate
}

function Save-StateFile {
    param($Item)
    if (-not $Item.StatePath) { return }
    $state = [ordered]@{
        status = $Item.Status
        progress = $Item.Progress
        message = $Item.Message
        output = $Item.Output
        finalSize = $Item.FinalSize
        reductionPercent = $Item.ReductionPercent
        elapsedSeconds = $Item.ElapsedSeconds
        startedAt = $Item.StartedAt
        finishedAt = $Item.FinishedAt
        ffmpegPid = $Item.FfmpegPid
        lms = $Item.Lms
        lmsLabel = $Item.LmsLabel
        courseId = $Item.CourseId
        zipName = $Item.ZipName
        updatedAt = (Get-Date).ToString("s")
    }
    $tmp = $Item.StatePath + ".tmp"
    $state | ConvertTo-Json -Compress | Set-Content -LiteralPath $tmp -Encoding UTF8
    try {
        Move-Item -LiteralPath $tmp -Destination $Item.StatePath -Force
    } catch {
        try {
            $state | ConvertTo-Json -Compress | Set-Content -LiteralPath $Item.StatePath -Encoding UTF8
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        } catch {
            Add-AppLog ("Advertencia: no se pudo guardar estado de {0}: {1}" -f $Item.Id, $_.Exception.Message)
        }
    }
}

function Update-ItemFromState {
    param($Item, $State)
    foreach ($name in @("status", "progress", "message", "output", "finalSize", "reductionPercent", "elapsedSeconds", "startedAt", "finishedAt", "ffmpegPid", "lms", "lmsLabel", "courseId", "zipName")) {
        if ($State.PSObject.Properties.Name -contains $name) {
            switch ($name) {
                "status" { $Item.Status = [string]$State.$name }
                "progress" { $Item.Progress = [int]$State.$name }
                "message" { $Item.Message = [string]$State.$name }
                "output" { $Item.Output = [string]$State.$name }
                "finalSize" { $Item.FinalSize = [int64]$State.$name }
                "reductionPercent" { $Item.ReductionPercent = if ($null -eq $State.$name) { $null } else { [double]$State.$name } }
                "elapsedSeconds" { $Item.ElapsedSeconds = [int]$State.$name }
                "startedAt" { $Item.StartedAt = [string]$State.$name }
                "finishedAt" { $Item.FinishedAt = [string]$State.$name }
                "ffmpegPid" { $Item.FfmpegPid = [int]$State.$name }
                "lms" { $Item.Lms = [string]$State.$name }
                "lmsLabel" { $Item.LmsLabel = [string]$State.$name }
                "courseId" { $Item.CourseId = [string]$State.$name }
                "zipName" { $Item.ZipName = [string]$State.$name }
            }
        }
    }
}

function Refresh-Items {
    foreach ($item in $script:Items.Values) {
        if ($item.StatePath -and (Test-Path -LiteralPath $item.StatePath)) {
            try {
                $state = Get-Content -LiteralPath $item.StatePath -Raw | ConvertFrom-Json
                Update-ItemFromState $item $state
            } catch {
                $item.Message = "No se pudo leer el estado del proceso."
            }
        }

        if ($item.WorkerPid) {
            $worker = Get-Process -Id $item.WorkerPid -ErrorAction SilentlyContinue
            if (-not $worker -and $item.Status -eq "running") {
                if ($item.CancelPath -and (Test-Path -LiteralPath $item.CancelPath)) {
                    if ($item.TempOutput -and (Test-Path -LiteralPath $item.TempOutput)) {
                        Remove-Item -LiteralPath $item.TempOutput -Force -ErrorAction SilentlyContinue
                    }
                    if ($item.PackageDir -and (Test-Path -LiteralPath $item.PackageDir)) {
                        Remove-Item -LiteralPath $item.PackageDir -Recurse -Force -ErrorAction SilentlyContinue
                    }
                    $item.Status = "canceled"
                    $item.Message = "Cancelado por usuario."
                    $item.Progress = 0
                } else {
                    $item.Status = "error"
                    $item.Message = "El proceso local termino sin confirmar el resultado."
                }
                $item.FinishedAt = (Get-Date).ToString("s")
                Save-StateFile $item
            }
            if (-not $worker -and $item.Status -in @("done", "error", "canceled")) {
                $item.WorkerPid = $null
                $item.FfmpegPid = 0
            }
        }
    }
    Start-Queue
}

function Get-QueueInfo {
    $active = @($script:Items.Values | Where-Object { $_.Status -in @("running", "queued") }).Count -gt 0
    if ($active -and -not $script:QueueStartedAt) {
        $script:QueueStartedAt = Get-Date
        $script:QueueFinishedAt = $null
    }
    if (-not $active -and $script:QueueStartedAt -and -not $script:QueueFinishedAt) {
        $script:QueueFinishedAt = Get-Date
    }
    $elapsed = 0
    if ($script:QueueStartedAt) {
        $end = if ($active) { Get-Date } else { $script:QueueFinishedAt }
        if ($end) { $elapsed = [int]($end - $script:QueueStartedAt).TotalSeconds }
    }
    return [ordered]@{ queueActive = $active; queueElapsedSeconds = $elapsed }
}

function Start-Queue {
    if ($script:CancelRequested) { return }
    $running = @($script:Items.Values | Where-Object { $_.Status -eq "running" }).Count
    if ($running -gt 0) { return }

    $item = $script:Items.Values | Where-Object { $_.Status -eq "queued" } | Select-Object -First 1
    if (-not $item) { return }

    $item.Status = "running"
    $item.Progress = 5
    $item.Message = "Procesando..."
    $item.StartedAt = (Get-Date).ToString("s")
    $item.FinishedAt = ""
    $item.ElapsedSeconds = 0
    $item.FinalSize = 0
    $item.ReductionPercent = $null
    $item.FfmpegPid = 0
    $item.StatePath = Join-Path $JobsDir ($item.Id + ".json")
    $item.CancelPath = Join-Path $JobsDir ($item.Id + ".cancel")
    $item.LogPath = Join-Path $JobsDir ($item.Id + ".log")
    $item.TempOutput = Join-Path $ProcessingDir ($item.Id + ".mp4")
    $item.PackageDir = Join-Path $PackagesDir $item.Id
    $item.Output = Get-SafeZipOutputPath -InputPath $item.Path -Height $item.Resolution -Lms $item.Lms -CourseId $item.CourseId
    $item.ZipName = [System.IO.Path]::GetFileName($item.Output)

    foreach ($path in @($item.StatePath, $item.CancelPath, $item.TempOutput)) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            if (Test-Path -LiteralPath $path) {
                Add-AppLog ("Advertencia: no se pudo eliminar archivo temporal anterior (posiblemente bloqueado): {0}" -f $path)
            }
        }
    }
    if ($item.PackageDir -and (Test-Path -LiteralPath $item.PackageDir)) {
        Remove-Item -LiteralPath $item.PackageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Save-StateFile $item

    $workerArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $WorkerPath,
        "-FfmpegPath", $FfmpegPath,
        "-InputPath", $item.Path,
        "-TempOutputPath", $item.TempOutput,
        "-FinalOutputPath", $item.Output,
        "-PackageDir", $item.PackageDir,
        "-TemplateDir", $TemplateDir,
        "-StatePath", $item.StatePath,
        "-CancelPath", $item.CancelPath,
        "-LogPath", $item.LogPath,
        "-AppLogPath", $AppLogPath,
        "-OriginalSize", [string]$item.Size,
        "-Height", [string]$item.Resolution,
        "-Lms", $item.Lms,
        "-CourseId", $item.CourseId
    )
    $argLine = Join-Arguments $workerArgs
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList $argLine -PassThru -WindowStyle Hidden
    $item.WorkerPid = $process.Id
    Add-AppLog ("Inicio de procesamiento: {0} | worker pid: {1}" -f $item.Name, $item.WorkerPid)
}

function Get-ItemsResponse {
    Refresh-Items
    $queue = Get-QueueInfo
    return [ordered]@{
        ok = $true
        ffmpegExists = (Test-Path -LiteralPath $FfmpegPath)
        inputDir = $InputDir
        outputDir = $OutputDir
        queueActive = $queue.queueActive
        queueElapsedSeconds = $queue.queueElapsedSeconds
        items = @($script:Items.Values | ForEach-Object { ConvertTo-PlainItem $_ })
    }
}

function New-ItemRecord {
    param(
        [string]$Path,
        [string]$Source,
        [string]$SourceLabel
    )
    $id = New-Id
    return [pscustomobject]@{
        Id = $id
        Name = [System.IO.Path]::GetFileName($Path)
        Path = $Path
        Size = Get-FileSize $Path
        Status = "pending"
        Message = "Pendiente."
        Progress = 0
        Output = ""
        TempOutput = ""
        PackageDir = ""
        FinalSize = 0
        ReductionPercent = $null
        Resolution = 720
        Source = $Source
        SourceLabel = $SourceLabel
        Lms = ""
        LmsLabel = ""
        CourseId = ""
        ZipName = ""
        ElapsedSeconds = 0
        StartedAt = ""
        FinishedAt = ""
        StatePath = ""
        CancelPath = ""
        LogPath = ""
        WorkerPid = $null
        FfmpegPid = 0
    }
}

function Add-InputFile {
    param([string]$Path)
    Add-VideoFile -Path $Path -Source "input" -SourceLabel "Desde input" -RequireInsideInput $true
}

function Add-VideoFile {
    param(
        [string]$Path,
        [string]$Source,
        [string]$SourceLabel,
        [bool]$RequireInsideInput = $false
    )
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if ($RequireInsideInput) {
        $inputRoot = [System.IO.Path]::GetFullPath($InputDir).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
        if (-not $fullPath.StartsWith($inputRoot, [System.StringComparison]::OrdinalIgnoreCase)) { return }
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return }
    if ([System.IO.Path]::GetExtension($fullPath).ToLowerInvariant() -ne ".mp4") { return }

    $existing = $script:Items.Values | Where-Object { $_.Path -eq $fullPath } | Select-Object -First 1
    if ($existing) {
        $existing.Name = [System.IO.Path]::GetFileName($fullPath)
        $existing.Size = Get-FileSize $fullPath
        $existing.Source = $Source
        $existing.SourceLabel = $SourceLabel
        if ($existing.Status -in @("error", "canceled")) {
            $existing.Status = "pending"
            $existing.Message = "Pendiente."
            $existing.Progress = 0
        }
        return
    }
    $item = New-ItemRecord -Path $fullPath -Source $Source -SourceLabel $SourceLabel
    $script:Items[$item.Id] = $item
}

function Scan-InputFolder {
    if (-not (Test-Path -LiteralPath $InputDir)) {
        New-Item -ItemType Directory -Force -Path $InputDir | Out-Null
    }
    $files = @(Get-ChildItem -LiteralPath $InputDir -Filter "*.mp4" -File -ErrorAction SilentlyContinue)
    $paths = @($files | ForEach-Object { $_.FullName })
    foreach ($id in @($script:Items.Keys)) {
        $item = $script:Items[$id]
        if ($item.Source -eq "input" -and $item.Status -ne "running" -and $paths -notcontains $item.Path) {
            $script:Items.Remove($id)
        }
    }
    foreach ($file in $files) { Add-InputFile $file.FullName }
    Add-AppLog ("Videos encontrados: {0}" -f $files.Count)
    return $files.Count
}

function Stop-Queue {
    $script:CancelRequested = $true
    Add-AppLog "Cancelacion del video actual solicitada por STOP."
    foreach ($item in $script:Items.Values) {
        if ($item.Status -eq "queued") {
            $item.Status = "pending"
            $item.Message = "Pendiente."
            $item.Progress = 0
        } elseif ($item.Status -eq "running") {
            $item.Message = "Cancelando..."
            if ($item.CancelPath) {
                Set-Content -LiteralPath $item.CancelPath -Value "cancel" -Encoding ASCII
            }
            $elapsed = 0
            if ($item.StartedAt) {
                try { $elapsed = [int]((Get-Date) - [datetime]$item.StartedAt).TotalSeconds } catch { $elapsed = $item.ElapsedSeconds }
            }
            if ($item.FfmpegPid -gt 0) {
                Add-AppLog ("STOP: taskkill FFmpeg pid {0}" -f $item.FfmpegPid)
                Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID $($item.FfmpegPid) /T /F" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
            }
            if ($item.WorkerPid) {
                Add-AppLog ("STOP: taskkill worker pid {0}" -f $item.WorkerPid)
                Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID $($item.WorkerPid) /T /F" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
                $item.WorkerPid = $null
            }
            if ($item.TempOutput -and (Test-Path -LiteralPath $item.TempOutput)) {
                for ($i = 0; $i -lt 10; $i++) {
                    Remove-Item -LiteralPath $item.TempOutput -Force -ErrorAction SilentlyContinue
                    if (-not (Test-Path -LiteralPath $item.TempOutput)) { break }
                    Start-Sleep -Milliseconds 300
                }
            }
            if ($item.PackageDir -and (Test-Path -LiteralPath $item.PackageDir)) {
                Remove-Item -LiteralPath $item.PackageDir -Recurse -Force -ErrorAction SilentlyContinue
            }
            $item.Status = "canceled"
            $item.Progress = 0
            $item.Message = "Cancelado por usuario."
            $item.ElapsedSeconds = $elapsed
            $item.FinishedAt = (Get-Date).ToString("s")
            Save-StateFile $item
        }
    }
}

function Test-HasActiveWork {
    return (@($script:Items.Values | Where-Object { $_.Status -in @("running", "queued") }).Count -gt 0)
}

function Test-ShouldShutdown {
    $active = Test-HasActiveWork

    # Modo integrado en la plataforma web: no apagar por falta de heartbeat.
    if ($env:COMPRESOR_NO_BROWSER -eq "1" -or $env:COMPRESOR_PLATFORM -eq "1") {
        if ($script:ShutdownRequested) {
            if ($active) { Stop-Queue }
            Add-AppLog "Apagado local solicitado desde la interfaz."
            return $true
        }
        return $false
    }

    # Apagado explícito desde la interfaz (ej: el usuario cerró el navegador)
    if ($script:ShutdownRequested) {
        if ($active) { Stop-Queue }
        Add-AppLog "Apagado local solicitado desde la interfaz."
        return $true
    }

    # NUNCA apagar mientras hay compresion activa.
    # Browsers throttlean setInterval en pestañas de fondo, lo que corta el heartbeat.
    # El trabajo de FFmpeg debe seguir aunque el usuario cambie de pestaña.
    if ($active) { return $false }

    $secondsSinceHeartbeat = [int]((Get-Date) - $script:LastHeartbeatAt).TotalSeconds
    $secondsSinceStart = [int]((Get-Date) - $script:StartedAt).TotalSeconds

    # Inactivo + sin heartbeat por 5 minutos → apagar
    if ($script:HasHeartbeat -and $secondsSinceHeartbeat -gt 300) {
        Add-AppLog "Sin heartbeat por 5 minutos y sin trabajo activo. Apagando servidor local."
        return $true
    }

    # Nunca recibio heartbeat y sin trabajo: apagar tras 3 minutos
    if (-not $script:HasHeartbeat -and $secondsSinceStart -gt 180) {
        Add-AppLog "No se recibio heartbeat inicial y no hay trabajo. Apagando servidor local."
        return $true
    }

    return $false
}

function Handle-Api {
    param($Context)
    $path = $Context.Request.Url.AbsolutePath
    $method = $Context.Request.HttpMethod.ToUpperInvariant()

    try {
        switch ($path) {
            "/api/health" { Write-JsonResponse $Context (Get-ItemsResponse); return }
            "/api/heartbeat" {
                $script:HasHeartbeat = $true
                $script:LastHeartbeatAt = Get-Date
                $script:ShutdownRequested = $false
                Write-JsonResponse $Context @{ ok = $true }
                return
            }
            "/api/shutdown" {
                $script:ShutdownRequested = $true
                Write-JsonResponse $Context @{ ok = $true }
                return
            }
            "/api/items" { Write-JsonResponse $Context (Get-ItemsResponse); return }
            "/api/scan-input" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                if (@($script:Items.Values | Where-Object { $_.Status -in @("running", "queued") }).Count -gt 0) {
                    Write-JsonResponse $Context @{ ok = $false; error = "No se puede buscar mientras hay un proceso activo." } 400
                    return
                }
                $script:CancelRequested = $false
                $found = Scan-InputFolder
                $response = Get-ItemsResponse
                $response["found"] = $found
                if ($found -eq 0) { $response["message"] = "No se encontraron videos .mp4 en input." }
                Write-JsonResponse $Context $response
                return
            }
            "/api/add-videos" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                if (@($script:Items.Values | Where-Object { $_.Status -in @("running", "queued") }).Count -gt 0) {
                    Write-JsonResponse $Context @{ ok = $false; error = "No se pueden agregar videos mientras hay un proceso activo." } 400
                    return
                }
                $script:CancelRequested = $false
                $selectionPath = Join-Path $TempDir ("selected_" + [guid]::NewGuid().ToString("N") + ".txt")
                $dialogArgs = @(
                    "-NoProfile",
                    "-STA",
                    "-ExecutionPolicy", "Bypass",
                    "-File", $SelectFilesPath,
                    "-OutputPath", $selectionPath
                )
                $dialogProcess = Start-Process -FilePath "powershell.exe" -ArgumentList (Join-Arguments $dialogArgs) -PassThru -WindowStyle Hidden
                $dialogProcess.WaitForExit(120000)
                if (-not $dialogProcess.HasExited) { try { $dialogProcess.Kill() } catch {} }
                $added = 0
                if (Test-Path -LiteralPath $selectionPath) {
                    $files = @(Get-Content -LiteralPath $selectionPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
                    foreach ($file in $files) {
                        $before = $script:Items.Count
                        Add-VideoFile -Path $file -Source "selected" -SourceLabel "Desde carpeta seleccionada"
                        if ($script:Items.Count -gt $before) { $added++ }
                    }
                    Remove-Item -LiteralPath $selectionPath -Force -ErrorAction SilentlyContinue
                }
                Add-AppLog ("Videos agregados desde dialogo: {0}" -f $added)
                $response = Get-ItemsResponse
                $response["added"] = $added
                Write-JsonResponse $Context $response
                return
            }
            "/api/start" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                $body = Read-RequestJson $Context.Request
                $height = 720
                if ($body.resolution -in @(480, 720)) { $height = [int]$body.resolution }
                $lms = ([string]$body.lms).Trim().ToLowerInvariant()
                $courseId = ([string]$body.courseId).Trim()
                $lmsInfo = Get-LmsInfo $lms
                if ($null -eq $lmsInfo) {
                    Write-JsonResponse $Context @{ ok = $false; error = "Selecciona una opcion de LMS antes de optimizar." } 400
                    return
                }
                if ($courseId -notmatch "^\d+$") {
                    Write-JsonResponse $Context @{ ok = $false; error = "El ID del curso debe ser numerico." } 400
                    return
                }
                if (-not (Test-Path -LiteralPath $FfmpegPath)) {
                    Write-JsonResponse $Context @{ ok = $false; error = "Falta FFmpeg en bin\ffmpeg.exe." } 400
                    return
                }
                $templateCheck = Test-PackageTemplate
                if (-not $templateCheck.Ok) {
                    Write-JsonResponse $Context @{ ok = $false; error = $templateCheck.Error } 400
                    return
                }

                $script:CancelRequested = $false
                $queued = 0
                foreach ($item in $script:Items.Values) {
                    if ($item.Status -in @("pending", "error")) {
                        if (-not (Test-Path -LiteralPath $item.Path)) {
                            $item.Status = "error"
                            $item.Message = "No se encontro el archivo original."
                            continue
                        }
                        $item.Resolution = $height
                        $item.Lms = $lmsInfo.Key
                        $item.LmsLabel = $lmsInfo.Label
                        $item.CourseId = $courseId
                        $item.Status = "queued"
                        $item.Progress = 0
                        $item.Message = "Pendiente."
                        $item.Output = ""
                        $item.TempOutput = ""
                        $item.PackageDir = ""
                        $item.FinalSize = 0
                        $item.ReductionPercent = $null
                        $item.ZipName = ""
                        $item.ElapsedSeconds = 0
                        $item.StartedAt = ""
                        $item.FinishedAt = ""
                        $queued++
                    }
                }
                if ($queued -eq 0 -and @($script:Items.Values | Where-Object { $_.Status -in @("running", "queued") }).Count -eq 0) {
                    Write-JsonResponse $Context @{ ok = $false; error = "No hay videos pendientes para optimizar." } 400
                    return
                }
                $script:QueueStartedAt = Get-Date
                $script:QueueFinishedAt = $null
                Start-Queue
                $response = Get-ItemsResponse
                if (-not [string]::IsNullOrWhiteSpace($templateCheck.Warning)) {
                    $response["warning"] = $templateCheck.Warning
                }
                Write-JsonResponse $Context $response
                return
            }
            "/api/stop" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                Stop-Queue
                Write-JsonResponse $Context (Get-ItemsResponse)
                return
            }
            "/api/remove" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                $body = Read-RequestJson $Context.Request
                $id = [string]$body.id
                if ($script:Items.Contains($id)) {
                    $item = $script:Items[$id]
                    if ($item.Status -eq "running") {
                        Write-JsonResponse $Context @{ ok = $false; error = "No se puede quitar un video en proceso." } 400
                        return
                    }
                    $script:Items.Remove($id)
                }
                Write-JsonResponse $Context (Get-ItemsResponse)
                return
            }
            "/api/open-output" {
                if ($method -ne "POST") { Write-JsonResponse $Context @{ ok = $false; error = "Metodo no permitido." } 405; return }
                if (-not (Test-Path -LiteralPath $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }
                Start-Process -FilePath $OutputDir
                Write-JsonResponse $Context @{ ok = $true; outputDir = $OutputDir }
                return
            }
            "/api/diag" {
                function Test-DirWritable {
                    param([string]$Dir)
                    if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return $false }
                    try {
                        $probe = Join-Path $Dir (".diag_" + [guid]::NewGuid().ToString("N"))
                        [System.IO.File]::WriteAllText($probe, "ok")
                        Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
                        return $true
                    } catch { return $false }
                }
                $ffmpegFound = Test-Path -LiteralPath $FfmpegPath
                $ffmpegVersion = ""
                $ffmpegRunnable = $false
                if ($ffmpegFound) {
                    try {
                        $psi2 = New-Object System.Diagnostics.ProcessStartInfo
                        $psi2.FileName = $FfmpegPath
                        $psi2.Arguments = "-version"
                        $psi2.UseShellExecute = $false
                        $psi2.RedirectStandardOutput = $true
                        $psi2.RedirectStandardError = $true
                        $psi2.CreateNoWindow = $true
                        $proc2 = New-Object System.Diagnostics.Process
                        $proc2.StartInfo = $psi2
                        [void]$proc2.Start()
                        $outTask = $proc2.StandardOutput.ReadToEndAsync()
                        $errTask = $proc2.StandardError.ReadToEndAsync()
                        [void]$proc2.WaitForExit(5000)
                        if (-not $proc2.HasExited) { try { $proc2.Kill() } catch {} }
                        $vOut = ""
                        try { $vOut = $outTask.Result } catch {}
                        try { if ([string]::IsNullOrEmpty($vOut)) { $vOut = $errTask.Result } } catch {}
                        if ($vOut -match "ffmpeg version ([^\s]+)") { $ffmpegVersion = $Matches[1] }
                        $ffmpegRunnable = ($proc2.ExitCode -eq 0 -or $ffmpegVersion -ne "")
                    } catch { $ffmpegRunnable = $false }
                }
                $winUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
                $policy = ""
                try { $policy = (Get-ExecutionPolicy -Scope CurrentUser -ErrorAction SilentlyContinue).ToString() } catch {}
                $activeFfmpeg = @(Get-Process -Name "ffmpeg" -ErrorAction SilentlyContinue).Count
                $dirsStatus = [ordered]@{}
                foreach ($kvp in @(
                    @{n="logs"; p=$LogsDir},
                    @{n="temp"; p=$TempDir},
                    @{n="temp/jobs"; p=$JobsDir},
                    @{n="temp/processing"; p=$ProcessingDir},
                    @{n="temp/paquetes"; p=$PackagesDir},
                    @{n="output"; p=$OutputDir}
                )) {
                    $dirsStatus[$kvp.n] = Test-DirWritable $kvp.p
                }
                Write-JsonResponse $Context ([ordered]@{
                    ok = $true
                    serverUrl = $selectedPrefix
                    uptimeSeconds = [int]((Get-Date) - $script:StartedAt).TotalSeconds
                    windowsUser = $winUser
                    executionPolicy = $policy
                    rootDir = $RootDir
                    ffmpegFound = $ffmpegFound
                    ffmpegRunnable = $ffmpegRunnable
                    ffmpegVersion = $ffmpegVersion
                    ffmpegPath = $FfmpegPath
                    templateOk = (Test-Path -LiteralPath (Join-Path $TemplateDir "index.html"))
                    dirs = $dirsStatus
                    activeJobs = @($script:Items.Values | Where-Object { $_.Status -in @("running","queued") }).Count
                    activeFfmpegProcesses = $activeFfmpeg
                })
                return
            }
            default { Write-JsonResponse $Context @{ ok = $false; error = "Ruta API no encontrada." } 404; return }
        }
    } catch {
        try { Write-JsonResponse $Context @{ ok = $false; error = $_.Exception.Message } 500 } catch {}
    }
}

function Serve-StaticFile {
    param($Context)
    $requestPath = [uri]::UnescapeDataString($Context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = "index.html" }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $AppDir $requestPath))
    $appFull = [System.IO.Path]::GetFullPath($AppDir).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $appRoot = $appFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($appRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-TextResponse $Context "Acceso no permitido." 403
        return
    }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        Write-TextResponse $Context "Archivo no encontrado." 404
        return
    }
    $bytes = [System.IO.File]::ReadAllBytes($candidate)
    Send-HttpResponse $Context $bytes 200 (Get-MimeType $candidate)
}

Add-AppLog ("Inicio de app. FFmpeg: {0}" -f $(if (Test-Path -LiteralPath $FfmpegPath) {"OK"} else {"NO ENCONTRADO"}))
$listener = $null
$selectedPrefix = $null

foreach ($port in 8787..8797) {
    try {
        $candidateListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
        $candidateListener.Start()
        $listener = $candidateListener
        $selectedPrefix = "http://localhost:$port/"
        break
    } catch {
        if ($candidateListener) { try { $candidateListener.Stop() } catch {} }
        continue
    }
}

if (-not $selectedPrefix) { throw "No se pudo iniciar el servidor local en los puertos 8787 a 8797." }

Add-AppLog ("Servidor escuchando en: {0}" -f $selectedPrefix)
Write-Host "Compresor de videos iniciado en $selectedPrefix"
Write-Host "Entrada: $InputDir"
Write-Host "Salida: $OutputDir"
Write-Host "Presione Ctrl+C para detener."

if ($env:COMPRESOR_NO_BROWSER -ne "1") { Start-Process $selectedPrefix }

try {
    while ($true) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            try {
                $request = Read-HttpRequest $client
                if ($null -eq $request) { $client.Close(); continue }
                $context = [pscustomobject]@{ Client = $client; Request = $request }
                if ($request.Url.AbsolutePath.StartsWith("/api/")) { Handle-Api $context } else { Serve-StaticFile $context }
            } catch {
                try {
                    if ($client.Connected) {
                        $errorContext = [pscustomobject]@{ Client = $client; Request = $null }
                        Write-JsonResponse $errorContext @{ ok = $false; error = $_.Exception.Message } 500
                    }
                } catch {} finally {
                    try { $client.Close() } catch {}
                }
            }
        } else {
            Start-Sleep -Milliseconds 200
        }

        if (Test-ShouldShutdown) {
            break
        }
    }
} finally {
    if ($listener) { $listener.Stop() }
}
