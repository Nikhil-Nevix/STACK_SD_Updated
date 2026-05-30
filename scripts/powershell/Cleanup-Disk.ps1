<#
.SYNOPSIS
    Automates disk space cleanup on a Windows system.
.DESCRIPTION
    Purges temporary files, system caches, log backups, and empties the Recycle Bin.
#>

Write-Output "[INFO] Initiating system disk cleanup..."

try {
    # 1. Check disk space before
    $Drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $FreeBeforeGB = [Math]::Round($Drive.FreeSpace / 1GB, 2)
    $SizeGB = [Math]::Round($Drive.Size / 1GB, 2)
    Write-Output "[INFO] Current C: drive capacity: $FreeBeforeGB GB free of $SizeGB GB."

    # 2. Clean User and System Temp Directories
    $PathsToClean = @(
        "$env:SystemRoot\Temp\*",
        "$env:LOCALAPPDATA\Temp\*",
        "$env:SystemRoot\Prefetch\*",
        "$env:SystemRoot\SoftwareDistribution\Download\*"
    )

    foreach ($Path in $PathsToClean) {
        Write-Output "[INFO] Cleaning: $Path"
        Remove-Item -Path $Path -Force -Recurse -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500

    # 3. Empty Recycle Bin
    Write-Output "[INFO] Emptying Recycle Bin..."
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300

    # 4. Check disk space after
    $DriveAfter = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $FreeAfterGB = [Math]::Round($DriveAfter.FreeSpace / 1GB, 2)
    $SpaceSaved = [Math]::Round($FreeAfterGB - $FreeBeforeGB, 2)

    Write-Output "[SUCCESS] Disk cleanup complete."
    Write-Output "[INFO] Saved $SpaceSaved GB of space. New free capacity: $FreeAfterGB GB."
}
catch {
    Write-Error "[ERROR] Disk cleanup failed. Error: $_"
    exit 1
}
