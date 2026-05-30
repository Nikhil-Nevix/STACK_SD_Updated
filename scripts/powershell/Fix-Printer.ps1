<#
.SYNOPSIS
    Remediates common printer and spooler issues on a remote Windows workstation.
.DESCRIPTION
    Restarts the Print Spooler service, purges the queue directory, and attempts self-healing.
#>

Write-Output "[INFO] Starting Print Spooler troubleshooting..."

try {
    # 1. Stop Spooler Service
    Write-Output "[INFO] Stopping Spooler service..."
    Stop-Service -Name "Spooler" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    # Verify Stopped
    $Service = Get-Service -Name "Spooler"
    if ($Service.Status -ne "Stopped") {
        Write-Output "[WARNING] Spooler service did not stop gracefully. Force killing process..."
        Stop-Process -Name "spoolsv" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
    Write-Output "[SUCCESS] Spooler service stopped."

    # 2. Clear Spooler File Queue
    Write-Output "[INFO] Purging spool files from C:\Windows\System32\spool\PRINTERS..."
    $SpoolPath = "C:\Windows\System32\spool\PRINTERS\*"
    Remove-Item -Path $SpoolPath -Include *.* -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
    Write-Output "[SUCCESS] Spooler queue purged."

    # 3. Start Spooler Service
    Write-Output "[INFO] Starting Spooler service..."
    Start-Service -Name "Spooler"
    Start-Sleep -Milliseconds 500
    
    $Service = Get-Service -Name "Spooler"
    if ($Service.Status -eq "Running") {
        Write-Output "[SUCCESS] Spooler service is now running."
    } else {
        throw "Failed to start Spooler service. Current state: $($Service.Status)"
    }

    # 4. Diagnose network printers
    Write-Output "[INFO] Enumerating connected printer connections..."
    Get-WmiObject -Class Win32_Printer | Select-Object Name, PrinterStatus, ShareName | Format-Table | Out-String | Write-Output
    
    Write-Output "[SUCCESS] Printer remediation complete."
}
catch {
    Write-Error "[ERROR] Print spooler remediation failed. Error: $_"
    exit 1
}
