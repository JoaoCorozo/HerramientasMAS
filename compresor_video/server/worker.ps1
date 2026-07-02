param(
    [Parameter(Mandatory=$true)][string]$FfmpegPath,
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$TempOutputPath,
    [Parameter(Mandatory=$true)][string]$FinalOutputPath,
    [Parameter(Mandatory=$true)][string]$PackageDir,
    [Parameter(Mandatory=$true)][string]$TemplateDir,
    [Parameter(Mandatory=$true)][string]$StatePath,
    [Parameter(Mandatory=$true)][string]$CancelPath,
    [Parameter(Mandatory=$true)][string]$LogPath,
    [Parameter(Mandatory=$true)][string]$AppLogPath,
    [Parameter(Mandatory=$true)][int64]$OriginalSize,
    [Parameter(Mandatory=$true)][int]$Height,
    [Parameter(Mandatory=$true)][string]$Lms,
    [Parameter(Mandatory=$true)][string]$CourseId
)

$ErrorActionPreference = "Stop"

function Add-Log {
    param([string]$Text)
    $line = "{0} {1}" -f (Get-Date).ToString("s"), $Text
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch {}
    try { Add-Content -LiteralPath $AppLogPath -Value $line -Encoding UTF8 } catch {}
}

function Get-LmsInfo {
    param([string]$Value)
    $enaexInglesLabel = "Enaex Ingl" + [string]([char]0x00E9) + "s"
    switch ($Value.ToLowerInvariant()) {
        "enaex_hispano" {
            return [pscustomobject]@{
                Key = "enaex_hispano"
                Label = "Enaex Hispano"
                BaseUrl = "https://enaexacademy.enaex.com/course/view.php?id="
            }
        }
        "enaex_ingles" {
            return [pscustomobject]@{
                Key = "enaex_ingles"
                Label = $enaexInglesLabel
                BaseUrl = "https://enaexacademyen.enaex.com/course/view.php?id="
            }
        }
        "enaex_brasil" {
            return [pscustomobject]@{
                Key = "enaex_brasil"
                Label = "Enaex Brasil"
                BaseUrl = "https://enaexacademybrasil.enaex.com/course/view.php?id="
            }
        }
        "habitat" {
            return [pscustomobject]@{
                Key = "habitat"
                Label = "Habitat"
                BaseUrl = "https://personas.afphabitat.cl/course/view.php?id="
            }
        }
        "bex" {
            return [pscustomobject]@{
                Key = "bex"
                Label = "BEX"
                BaseUrl = "https://www.gestiondepersonasbex.cl/course/view.php?id="
            }
        }
        "banco_internacional" {
            return [pscustomobject]@{
                Key = "banco_internacional"
                Label = "Banco Internacional"
                BaseUrl = "https://plataformaavanza.interconecta2.cl/course/view.php?id="
            }
        }
        "transelec" {
            return [pscustomobject]@{
                Key = "transelec"
                Label = "Transelec"
                BaseUrl = "https://www.portalaprende.com/course/view.php?id="
            }
        }
        "aza" {
            return [pscustomobject]@{
                Key = "aza"
                Label = "AZA"
                BaseUrl = "https://www.azacapacita.cl/course/view.php?id="
            }
        }
        "carozzi" {
            return [pscustomobject]@{
                Key = "carozzi"
                Label = "Carozzi"
                BaseUrl = "https://micamino.carozzicorp.com/course/view.php?id="
            }
        }
        default {
            return [pscustomobject]@{
                Key = "enaex_hispano"
                Label = "Enaex Hispano"
                BaseUrl = "https://enaexacademy.enaex.com/course/view.php?id="
            }
        }
    }
}

$lmsInfo = Get-LmsInfo $Lms

function Save-State {
    param(
        [string]$Status,
        [int]$Progress,
        [string]$Message,
        [string]$Output,
        [int64]$FinalSize,
        [Nullable[double]]$ReductionPercent,
        [int]$ElapsedSeconds,
        [string]$StartedAt,
        [string]$FinishedAt,
        [int]$FfmpegPid,
        [string]$ZipName
    )

    $state = [ordered]@{
        status = $Status
        progress = $Progress
        message = $Message
        output = $Output
        finalSize = $FinalSize
        reductionPercent = $ReductionPercent
        elapsedSeconds = $ElapsedSeconds
        startedAt = $StartedAt
        finishedAt = $FinishedAt
        ffmpegPid = $FfmpegPid
        lms = $lmsInfo.Key
        lmsLabel = $lmsInfo.Label
        courseId = $CourseId
        zipName = $ZipName
        updatedAt = (Get-Date).ToString("s")
    }
    $tmp = $StatePath + ".tmp"
    $state | ConvertTo-Json -Compress | Set-Content -LiteralPath $tmp -Encoding UTF8
    try {
        Move-Item -LiteralPath $tmp -Destination $StatePath -Force
    } catch {
        try {
            $state | ConvertTo-Json -Compress | Set-Content -LiteralPath $StatePath -Encoding UTF8
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        } catch {
            Add-Log ("Advertencia: no se pudo guardar estado: {0}" -f $_.Exception.Message)
        }
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

function Get-SimulatedProgress {
    param([int]$ElapsedSeconds)
    $value = 5 + [int][Math]::Floor($ElapsedSeconds * 1.5)
    return [Math]::Min(95, [Math]::Max(5, $value))
}

function Get-RealProgress {
    # Progreso real desde archivo de progreso de FFmpeg (-progress flag)
    if ($durationSeconds -gt 0 -and $progressFile -and (Test-Path -LiteralPath $progressFile)) {
        try {
            $fs = [System.IO.File]::Open(
                $progressFile,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::Read,
                [System.IO.FileShare]::ReadWrite)
            $content = ""
            try {
                $fileLen = $fs.Length
                if ($fileLen -gt 0) {
                    # Leer solo los ultimos 4KB (suficiente para el bloque mas reciente)
                    $readLen = [Math]::Min($fileLen, 4096)
                    [void]$fs.Seek($fileLen - $readLen, [System.IO.SeekOrigin]::Begin)
                    $buf = New-Object byte[] $readLen
                    $n = $fs.Read($buf, 0, $readLen)
                    $content = [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
                }
            } finally { $fs.Dispose() }
            $mMatches = [regex]::Matches($content, "out_time_us=(\d+)")
            if ($mMatches.Count -gt 0) {
                $us = [long]$mMatches[$mMatches.Count - 1].Groups[1].Value
                $sec = $us / 1000000.0
                return [int][Math]::Max(5, [Math]::Min(95, ($sec / $durationSeconds) * 95.0))
            }
        } catch {}
    }
    # Fallback: progreso simulado por tiempo transcurrido
    return Get-SimulatedProgress ([int]((Get-Date) - $started).TotalSeconds)
}

function Clear-TemporaryFiles {
    if ($TempOutputPath -and (Test-Path -LiteralPath $TempOutputPath)) {
        Remove-Item -LiteralPath $TempOutputPath -Force -ErrorAction SilentlyContinue
    }
    if ($progressFile -and (Test-Path -LiteralPath $progressFile)) {
        Remove-Item -LiteralPath $progressFile -Force -ErrorAction SilentlyContinue
    }
    if ($PackageDir -and (Test-Path -LiteralPath $PackageDir)) {
        Remove-Item -LiteralPath $PackageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function New-RedirectIndex {
    param([string]$DestinationPath)
    $target = $lmsInfo.BaseUrl + $CourseId
    $html = @"
<html>
<head>
<script type="text/javascript">
location.href = "$target";
</script>
</head>
<body>
</body>
</html>
"@
    Set-Content -LiteralPath $DestinationPath -Value $html -Encoding UTF8
}

function New-VideoPackage {
    if (Test-Path -LiteralPath $PackageDir) {
        Remove-Item -LiteralPath $PackageDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null

    if (-not (Test-Path -LiteralPath $TemplateDir -PathType Container)) {
        throw "No existe la carpeta plantilla: carpeta para el video."
    }
    $templateItems = @(Get-ChildItem -LiteralPath $TemplateDir -Force)
    if ($templateItems.Count -eq 0) {
        throw "La carpeta plantilla esta vacia."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $TemplateDir "index.html") -PathType Leaf)) {
        throw "La plantilla debe incluir index.html."
    }

    foreach ($templateItem in $templateItems) {
        Copy-Item -LiteralPath $templateItem.FullName -Destination $PackageDir -Recurse -Force
    }

    Copy-Item -LiteralPath $TempOutputPath -Destination (Join-Path $PackageDir "video.mp4") -Force
    New-RedirectIndex -DestinationPath (Join-Path $PackageDir "index2.html")

    $outputPath = $FinalOutputPath
    if (Test-Path -LiteralPath $outputPath) {
        $baseStem = [System.IO.Path]::GetFileNameWithoutExtension($outputPath)
        $zipDir = [System.IO.Path]::GetDirectoryName($outputPath)
        $n = 2
        do {
            $outputPath = Join-Path $zipDir ("{0}_{1}.zip" -f $baseStem, $n)
            $n++
        } while (Test-Path -LiteralPath $outputPath)
        $script:FinalOutputPath = $outputPath
        $script:zipName = [System.IO.Path]::GetFileName($outputPath)
        Add-Log ("ZIP ya existia. Nombre unico generado: {0}" -f $outputPath)
    }

    $itemsToZip = @(Get-ChildItem -LiteralPath $PackageDir -Force)
    if ($itemsToZip.Count -eq 0) {
        throw "No se pudo preparar el paquete ZIP."
    }
    $zipPaths = @($itemsToZip | ForEach-Object { $_.FullName })
    Compress-Archive -LiteralPath $zipPaths -DestinationPath $outputPath -Force
}

$started = Get-Date
$startedText = $started.ToString("s")
$ffmpegPid = 0
$zipName = [System.IO.Path]::GetFileName($FinalOutputPath)
$progressFile = $LogPath + ".progress"
$durationSeconds = 0.0

try {
    if (Test-Path -LiteralPath $LogPath) {
        Remove-Item -LiteralPath $LogPath -Force
    }
    Clear-TemporaryFiles

    if (-not (Test-Path -LiteralPath $FfmpegPath)) {
        Save-State "error" 0 "Falta FFmpeg." "" 0 $null 0 $startedText (Get-Date).ToString("s") 0 ""
        Add-Log "Error: falta ffmpeg.exe."
        exit 1
    }

    if (-not (Test-Path -LiteralPath $InputPath)) {
        Save-State "error" 0 "No se encontro el video original." "" 0 $null 0 $startedText (Get-Date).ToString("s") 0 ""
        Add-Log "Error: no se encontro el archivo de entrada."
        exit 1
    }

    # Verificar permiso de escritura en carpeta de salida (output)
    $outputDir = [System.IO.Path]::GetDirectoryName($FinalOutputPath)
    if (-not (Test-Path -LiteralPath $outputDir)) {
        try {
            New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
            Add-Log ("Carpeta de salida creada: {0}" -f $outputDir)
        } catch {
            $msg = "No se puede crear la carpeta de salida: {0}. Error: {1}" -f $outputDir, $_.Exception.Message
            Save-State "error" 0 $msg "" 0 $null 0 $startedText (Get-Date).ToString("s") 0 ""
            Add-Log $msg
            exit 1
        }
    }
    try {
        $writeTest = Join-Path $outputDir (".write_test_" + [guid]::NewGuid().ToString("N"))
        [System.IO.File]::WriteAllText($writeTest, "ok")
        Remove-Item -LiteralPath $writeTest -Force -ErrorAction SilentlyContinue
    } catch {
        $msg = "Sin permiso de escritura en la carpeta de salida: {0}. Error: {1}" -f $outputDir, $_.Exception.Message
        Save-State "error" 0 $msg "" 0 $null 0 $startedText (Get-Date).ToString("s") 0 ""
        Add-Log $msg
        exit 1
    }

    # Sonda rapida de duracion del video para calcular progreso real
    try {
        $probePsi = New-Object System.Diagnostics.ProcessStartInfo
        $probePsi.FileName = $FfmpegPath
        $probePsi.Arguments = "-hide_banner -i " + (Quote-Argument $InputPath)
        $probePsi.UseShellExecute = $false
        $probePsi.RedirectStandardError = $true
        $probePsi.RedirectStandardOutput = $false
        $probePsi.CreateNoWindow = $true
        $probeProc = New-Object System.Diagnostics.Process
        $probeProc.StartInfo = $probePsi
        [void]$probeProc.Start()
        $probeTask = $probeProc.StandardError.ReadToEndAsync()
        [void]$probeProc.WaitForExit(5000)
        if (-not $probeProc.HasExited) { try { $probeProc.Kill() } catch {} }
        $probeOutput = ""
        try { $probeOutput = $probeTask.Result } catch {}
        if ($probeOutput -match "Duration:\s*(\d+):(\d+):(\d+)\.(\d+)") {
            $hh = [int]$Matches[1]; $mm = [int]$Matches[2]; $ss = [int]$Matches[3]; $cc = [int]$Matches[4]
            $durationSeconds = $hh * 3600.0 + $mm * 60.0 + $ss + ($cc / 100.0)
            Add-Log ("Duracion detectada: {0:F1}s" -f $durationSeconds)
        } else {
            Add-Log "Duracion no detectada. Usando progreso simulado por tiempo."
        }
    } catch {
        Add-Log ("Error en sonda de duracion (no critico): {0}" -f $_.Exception.Message)
    }

    $filter = "scale='if(gt(ih,$Height),-2,trunc(iw/2)*2)':'if(gt(ih,$Height),$Height,trunc(ih/2)*2)'"
    $ffmpegArgs = @(
        "-y",
        "-nostdin",
        "-v", "error",
        "-hide_banner",
        "-progress", $progressFile,
        "-i", $InputPath,
        "-vf", $filter,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-threads", "0",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        $TempOutputPath
    )

    Add-Log ("Comando FFmpeg usado: {0} {1}" -f $FfmpegPath, (Join-Arguments $ffmpegArgs))
    Save-State "running" 5 "Procesando..." "" 0 $null 0 $startedText "" 0 $zipName

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FfmpegPath
    $psi.Arguments = Join-Arguments $ffmpegArgs
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()

    # Task-based async read: seguro en PS 5.1, no usa delegates en hilos background
    $stderrTask = $process.StandardError.ReadToEndAsync()

    $ffmpegPid = $process.Id
    Add-Log ("pid del proceso FFmpeg: {0}" -f $ffmpegPid)
    Save-State "running" 5 "Procesando..." "" 0 $null 0 $startedText "" $ffmpegPid $zipName

    $lastProgressPct = 5
    $lastAdvanceTime = Get-Date
    $watchdogLogged = $false

    while (-not $process.HasExited) {
        if (Test-Path -LiteralPath $CancelPath) {
            Add-Log "Cancelacion por STOP detectada por worker."
            try {
                Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID $ffmpegPid /T /F" -WindowStyle Hidden -Wait
            } catch {
                Add-Log ("Error al cancelar FFmpeg: {0}" -f $_.Exception.Message)
            }
            break
        }

        $elapsed = [int]((Get-Date) - $started).TotalSeconds
        $progress = Get-RealProgress

        # Watchdog: detectar si FFmpeg dejo de avanzar
        if ($progress -gt $lastProgressPct) {
            $lastProgressPct = $progress
            $lastAdvanceTime = Get-Date
            $watchdogLogged = $false
        } else {
            $stuckSecs = [int]((Get-Date) - $lastAdvanceTime).TotalSeconds
            if ($stuckSecs -gt 300 -and -not $watchdogLogged) {
                Add-Log ("WATCHDOG: sin progreso en {0}s. FFmpeg PID {1} sigue activo." -f $stuckSecs, $ffmpegPid)
                $watchdogLogged = $true
            }
        }

        Save-State "running" $progress "Procesando..." "" 0 $null $elapsed $startedText "" $ffmpegPid $zipName
        Start-Sleep -Seconds 1
    }

    # WaitForExit() sin timeout garantiza que la lectura asincrona de stderr tambien completa
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $finished = Get-Date
    $elapsedTotal = [int]($finished - $started).TotalSeconds

    $ffmpegStderr = ""
    try {
        $stderrResult = $stderrTask.Result
        if (-not [string]::IsNullOrWhiteSpace($stderrResult)) {
            $ffmpegStderr = ($stderrResult.Trim() -replace "`r`n|`n", " | ")
            Add-Log ("FFmpeg stderr: {0}" -f $ffmpegStderr)
        }
    } catch {}

    Add-Log ("cierre de FFmpeg. codigo de salida: {0}" -f $exitCode)

    if (Test-Path -LiteralPath $CancelPath) {
        Clear-TemporaryFiles
        Save-State "canceled" 0 "Cancelado por usuario." "" 0 $null $elapsedTotal $startedText $finished.ToString("s") 0 ""
        Add-Log "Cancelacion completada. Temporales eliminados."
        exit 2
    }

    if ($exitCode -eq 0 -and (Test-Path -LiteralPath $TempOutputPath)) {
        Save-State "running" 96 "Creando paquete ZIP..." "" 0 $null $elapsedTotal $startedText "" 0 $zipName
        New-VideoPackage
        Remove-Item -LiteralPath $TempOutputPath -Force -ErrorAction SilentlyContinue
        if ($progressFile -and (Test-Path -LiteralPath $progressFile)) {
            Remove-Item -LiteralPath $progressFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $PackageDir) {
            Remove-Item -LiteralPath $PackageDir -Recurse -Force -ErrorAction SilentlyContinue
        }

        $finalSize = ([System.IO.FileInfo]$FinalOutputPath).Length
        $reduction = $null
        if ($OriginalSize -gt 0) {
            $reduction = [Math]::Round((1 - ($finalSize / [double]$OriginalSize)) * 100, 1)
        }
        Save-State "done" 100 "Finalizado." $FinalOutputPath $finalSize $reduction $elapsedTotal $startedText $finished.ToString("s") 0 $zipName
        Add-Log ("ZIP final generado: {0}" -f $FinalOutputPath)
        Add-Log ("tiempo total: {0}s" -f $elapsedTotal)
        exit 0
    }

    Clear-TemporaryFiles
    Add-Log ("Error de FFmpeg (codigo $exitCode). Temporales eliminados.")
    Save-State "error" 0 "No se pudo comprimir el video. Revisa que el archivo no este danado y que tengas permisos en la carpeta de salida." "" 0 $null $elapsedTotal $startedText $finished.ToString("s") 0 ""
    exit 1
} catch {
    $finished = Get-Date
    $elapsedTotal = [int]($finished - $started).TotalSeconds
    Clear-TemporaryFiles
    Add-Log ("Error interno del worker: {0}" -f $_.Exception.Message)
    Save-State "error" 0 "Error inesperado al procesar el video. Revisa los logs para mas detalles." "" 0 $null $elapsedTotal $startedText $finished.ToString("s") 0 ""
    exit 1
}
