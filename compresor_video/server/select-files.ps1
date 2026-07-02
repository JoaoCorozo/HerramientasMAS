param(
    [Parameter(Mandatory=$true)][string]$OutputPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = "CenterScreen"
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Multiselect = $true
$dialog.Filter = "Videos MP4 (*.mp4)|*.mp4"
$dialog.Title = "Agregar videos MP4"

try {
    $owner.Show()
    if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
        [System.IO.File]::WriteAllLines($OutputPath, $dialog.FileNames, [System.Text.Encoding]::UTF8)
    } else {
        [System.IO.File]::WriteAllText($OutputPath, "", [System.Text.Encoding]::UTF8)
    }
} finally {
    $dialog.Dispose()
    $owner.Close()
    $owner.Dispose()
}
