"""
PowerShell / WinRM Remote Execution Integration.
Executes remediation scripts on Windows devices via WinRM.
Activates when WINRM_USERNAME and WINRM_PASSWORD are set.
"""
import logging
from typing import Optional

logger = logging.getLogger("stack.powershell")

REMEDIATION_SCRIPTS = {
    "password_reset": """
# Password Reset Script
$UserPrincipalName = "{user_email}"
try {{
    Set-ADAccountPassword -Identity $UserPrincipalName -Reset -NewPassword (ConvertTo-SecureString "TempPass@123!" -AsPlainText -Force)
    Unlock-ADAccount -Identity $UserPrincipalName
    Write-Output "Password reset successful for $UserPrincipalName"
}} catch {{
    Write-Error "Password reset failed: $_"
    exit 1
}}
""",
    "printer_fix": """
# Printer Troubleshooting Script
Stop-Service -Name Spooler -Force
Remove-Item "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -Recurse -ErrorAction SilentlyContinue
Start-Service -Name Spooler
Write-Output "Print spooler restarted and queue cleared successfully"
""",
    "disk_cleanup": """
# Disk Cleanup Script
$before = (Get-PSDrive C).Used
Remove-Item "$env:TEMP\\*" -Force -Recurse -ErrorAction SilentlyContinue
Remove-Item "$env:SystemRoot\\Temp\\*" -Force -Recurse -ErrorAction SilentlyContinue
cleanmgr /sagerun:1 /NORESTART 2>$null
$after = (Get-PSDrive C).Used
$freed = [math]::Round(($before - $after) / 1GB, 2)
Write-Output "Disk cleanup completed. Freed approximately ${freed}GB"
""",
    "performance_fix": """
# Performance Optimization Script
$procs = Get-Process | Where-Object {{$_.CPU -gt 80}} | Sort-Object CPU -Descending | Select-Object -First 5
if ($procs) {{
    $procs | ForEach-Object {{ Write-Output "High CPU: $($_.Name) - $($_.CPU)%" }}
}} else {{
    Write-Output "No high-CPU processes found"
}}
# Clear DNS cache
Clear-DnsClientCache
Write-Output "Performance optimization completed"
""",
    "network_fix": """
# Network Troubleshooting Script
ipconfig /release
ipconfig /renew
ipconfig /flushdns
netsh winsock reset catalog
netsh int ip reset resetlog.txt
Write-Output "Network adapter reset and DNS flushed successfully"
""",
    "software_install": """
# Software Installation Script
param([string]$PackageName)
winget install --id $PackageName --silent --accept-package-agreements --accept-source-agreements
Write-Output "Software installation completed: $PackageName"
""",
}

ISSUE_SCRIPT_MAP = {
    "password": "password_reset",
    "printer": "printer_fix",
    "disk": "disk_cleanup",
    "space": "disk_cleanup",
    "slow": "performance_fix",
    "performance": "performance_fix",
    "network": "network_fix",
    "connectivity": "network_fix",
    "internet": "network_fix",
    "install": "software_install",
    "software": "software_install",
}


class PowerShellClient:
    def __init__(self):
        from app.config import get_settings
        s = get_settings()
        self.username = s.winrm_username
        self.password = s.winrm_password
        self.transport = s.winrm_transport

    def is_configured(self) -> bool:
        return bool(self.username and self.password)

    def _detect_script(self, description: str) -> str:
        description_lower = description.lower()
        for keyword, script_name in ISSUE_SCRIPT_MAP.items():
            if keyword in description_lower:
                return script_name
        return "performance_fix"

    async def execute_remediation(
        self,
        device_ip: Optional[str],
        issue_description: str,
        use_case: str,
        user_email: str = "",
    ) -> str:
        import asyncio
        script_name = self._detect_script(issue_description)
        script = REMEDIATION_SCRIPTS.get(script_name, REMEDIATION_SCRIPTS["performance_fix"])
        script = script.format(user_email=user_email)

        if not device_ip:
            return f"[SIMULATION] Would execute '{script_name}' on device. Device IP not available — configure users table with device information."

        # Execute via WinRM in a thread pool (pywinrm is sync)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._execute_sync, device_ip, script, script_name)
        return result

    def _execute_sync(self, device_ip: str, script: str, script_name: str) -> str:
        try:
            import winrm
            session = winrm.Session(
                f"http://{device_ip}:5985/wsman",
                auth=(self.username, self.password),
                transport=self.transport,
                server_cert_validation="ignore",
            )
            result = session.run_ps(script)
            if result.status_code == 0:
                output = result.std_out.decode("utf-8", errors="replace").strip()
                return f"Script '{script_name}' executed successfully.\nOutput:\n{output}"
            else:
                error = result.std_err.decode("utf-8", errors="replace").strip()
                return f"Script '{script_name}' failed.\nError:\n{error}"
        except Exception as e:
            logger.error(f"WinRM execution failed: {e}")
            raise
