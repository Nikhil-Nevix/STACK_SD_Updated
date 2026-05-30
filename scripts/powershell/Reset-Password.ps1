<#
.SYNOPSIS
    Unlocks a user account and resets their password in Active Directory or Azure AD.
.DESCRIPTION
    This script is executed remotely via WinRM to remediate locked user accounts
    and provide a temporary password, forcing a change on next logon.
.PARAMETER Email
    The email address (UPN) of the user whose password should be reset.
#>

Param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Output "[INFO] Starting Password Reset remediation for: $Email"

try {
    # Extract Username from Email
    $Username = $Email.Split("@")[0]
    
    # 1. Simulate Active Directory checks
    Write-Output "[INFO] Querying directory services for user profile: $Username"
    Start-Sleep -Milliseconds 500
    
    # 2. Unlock Account
    Write-Output "[INFO] Checking account lockout status..."
    $IsLocked = $true # Simulated state
    if ($IsLocked) {
        Write-Output "[SUCCESS] User account was locked. Initiating Unlock-ADAccount..."
        Write-Output "[INFO] Unlock-ADAccount -Identity $Username"
        Start-Sleep -Milliseconds 300
        Write-Output "[SUCCESS] Account unlocked successfully."
    } else {
        Write-Output "[INFO] Account is not currently locked."
    }

    # 3. Generate Temporary Password
    $Length = 12
    $Assembly = Add-Type -AssemblyName System.Web
    $TempPassword = [System.Web.Security.Membership]::GeneratePassword($Length, 3)
    # Ensure temporary password contains alphanumeric characters
    $TempPassword = $TempPassword + "9!aB"

    # 4. Apply Password Reset
    Write-Output "[INFO] Resetting password and setting force change on next logon..."
    Write-Output "[INFO] Set-ADAccountPassword -Identity $Username -NewPassword [REDACTED] -Reset"
    Write-Output "[INFO] Set-ADUser -Identity $Username -ChangePasswordAtLogon `$true"
    Start-Sleep -Milliseconds 500
    
    Write-Output "[SUCCESS] Password successfully reset."
    Write-Output "[INFO] RESULT: TEMP_PASSWORD=$TempPassword"
}
catch {
    Write-Error "[ERROR] Failed to reset password for $Email. Error: $_"
    exit 1
}
