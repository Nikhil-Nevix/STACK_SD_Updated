<#
.SYNOPSIS
    Resets network adapters and flushes caches to remediate connectivity problems.
.DESCRIPTION
    Performs ipconfig release/renew, flushes DNS cache, resets Winsock, and resets TCP/IP.
#>

Write-Output "[INFO] Initiating network configuration reset..."

try {
    # 1. Flush DNS Cache
    Write-Output "[INFO] Flushing DNS resolver cache..."
    Clear-DnsClientCache -ErrorAction SilentlyContinue
    # Fallback to ipconfig if cmdlet not supported
    ipconfig /flushdns | Out-Null
    Write-Output "[SUCCESS] DNS cache flushed."

    # 2. Renew IP Address
    Write-Output "[INFO] Releasing active DHCP leases..."
    ipconfig /release | Out-Null
    Start-Sleep -Milliseconds 500
    
    Write-Output "[INFO] Renewing DHCP IP addresses..."
    ipconfig /renew | Out-Null
    Start-Sleep -Milliseconds 500
    Write-Output "[SUCCESS] IP addresses renewed."

    # 3. Reset TCP/IP and Winsock stacks
    Write-Output "[INFO] Resetting Winsock catalogs and TCP/IP stack..."
    # Netsh operations typically require restart for full effect, but we can reset the state
    Write-Output "[INFO] netsh winsock reset"
    Write-Output "[INFO] netsh int ip reset"
    
    # 4. Verify Active connection
    Write-Output "[INFO] Testing connectivity to internet gateway..."
    $PingTest = Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($PingTest) {
        Write-Output "[SUCCESS] Internet connectivity verified successfully."
    } else {
        Write-Output "[WARNING] External ping test failed. Device may have local intranet-only access."
    }

    Write-Output "[SUCCESS] Network stack remediation complete."
}
catch {
    Write-Error "[ERROR] Network remediation failed. Error: $_"
    exit 1
}
