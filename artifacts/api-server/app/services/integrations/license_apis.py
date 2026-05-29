"""
License API Integrations — Adobe Creative Cloud, BlueBeam, and O365.
Each provider activates when its credentials are configured.
"""
import logging
import httpx
from typing import Optional

logger = logging.getLogger("stack.license_apis")


class LicenseAPIClient:
    def __init__(self):
        from app.config import get_settings
        s = get_settings()
        self.adobe_client_id = s.adobe_client_id
        self.adobe_client_secret = s.adobe_client_secret
        self.bluebeam_api_key = s.bluebeam_api_key

    def is_configured(self, license_type: str) -> bool:
        if license_type == "adobe":
            return bool(self.adobe_client_id and self.adobe_client_secret)
        elif license_type == "bluebeam":
            return bool(self.bluebeam_api_key)
        elif license_type == "o365":
            from app.services.integrations.graph_api import GraphAPIClient
            return GraphAPIClient().is_configured()
        return False

    async def assign_license(self, user_email: str, license_type: str) -> str:
        if license_type == "adobe":
            return await self._assign_adobe(user_email)
        elif license_type == "bluebeam":
            return await self._assign_bluebeam(user_email)
        elif license_type == "o365":
            return await self._assign_o365(user_email)
        return f"Unknown license type: {license_type}"

    async def revoke_license(self, user_email: str, license_type: str) -> str:
        if license_type == "adobe":
            return await self._revoke_adobe(user_email)
        elif license_type == "bluebeam":
            return await self._revoke_bluebeam(user_email)
        elif license_type == "o365":
            return await self._revoke_o365(user_email)
        return f"Unknown license type: {license_type}"

    # --- Adobe Creative Cloud ---

    async def _get_adobe_token(self) -> str:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://ims-na1.adobelogin.com/ims/token/v3",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.adobe_client_id,
                    "client_secret": self.adobe_client_secret,
                    "scope": "AdobeID,openid,read_organizations,additional_info.projectedProductContext",
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def _assign_adobe(self, user_email: str) -> str:
        token = await self._get_adobe_token()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://usermanagement.adobe.io/v2/usermanagement/action/REPLACE_WITH_ORG_ID",
                json=[{
                    "user": user_email,
                    "do": [{"addProductProfiles": ["Creative Cloud"]}],
                }],
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-api-key": self.adobe_client_id,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            return f"Adobe Creative Cloud license assigned to {user_email}"

    async def _revoke_adobe(self, user_email: str) -> str:
        token = await self._get_adobe_token()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://usermanagement.adobe.io/v2/usermanagement/action/REPLACE_WITH_ORG_ID",
                json=[{
                    "user": user_email,
                    "do": [{"removeProductProfiles": ["Creative Cloud"]}],
                }],
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-api-key": self.adobe_client_id,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            return f"Adobe Creative Cloud license revoked for {user_email}"

    # --- BlueBeam ---

    async def _assign_bluebeam(self, user_email: str) -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.bluebeam.com/v1/users",
                json={"email": user_email, "product": "Revu"},
                headers={"x-api-key": self.bluebeam_api_key},
            )
            resp.raise_for_status()
            return f"BlueBeam Revu license assigned to {user_email}"

    async def _revoke_bluebeam(self, user_email: str) -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.delete(
                f"https://api.bluebeam.com/v1/users/{user_email}",
                headers={"x-api-key": self.bluebeam_api_key},
            )
            resp.raise_for_status()
            return f"BlueBeam license revoked for {user_email}"

    # --- O365 (via Graph API) ---

    async def _assign_o365(self, user_email: str) -> str:
        from app.services.integrations.graph_api import GraphAPIClient
        client = GraphAPIClient()
        # E3 SKU ID — replace with actual tenant SKU
        O365_E3_SKU = "6fd2c87f-b296-42f0-b197-1e91e994b900"
        return await client.assign_o365_license(user_email, O365_E3_SKU)

    async def _revoke_o365(self, user_email: str) -> str:
        from app.services.integrations.graph_api import GraphAPIClient
        client = GraphAPIClient()
        O365_E3_SKU = "6fd2c87f-b296-42f0-b197-1e91e994b900"
        return await client.remove_o365_license(user_email, O365_E3_SKU)
