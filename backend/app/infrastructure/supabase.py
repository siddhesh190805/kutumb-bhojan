import httpx
from typing import Any
from backend.app.config import settings


class SupabaseClient:
    def __init__(self):
        self.base_url = settings.supabase_url.rstrip("/")
        self.publishable_key = settings.supabase_publishable_key
        self.service_role_key = settings.supabase_service_role_key
        self._cached_token: str | None = None

    def _get_auth_headers(self, custom_token: str | None = None) -> dict[str, str]:
        """Return HTTP headers with apikey and Bearer Authorization."""
        if self.service_role_key:
            return {
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            }
        
        token = custom_token or self._cached_token
        if not token:
            token = self._authenticate_anonymously()

        return {
            "apikey": self.publishable_key,
            "Authorization": f"Bearer {token}",
        }

    def _authenticate_anonymously(self) -> str:
        """Obtain an anonymous user token from Supabase Auth."""
        url = f"{self.base_url}/auth/v1/signup"
        headers = {
            "apikey": self.publishable_key,
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json={}, headers=headers)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Anonymous Supabase authentication failed: {resp.status_code} {resp.text}")
            data = resp.json()
            token = data.get("access_token")
            if not token:
                raise RuntimeError("No access_token returned by Supabase anonymous auth")
            self._cached_token = token
            return token

    def get(
        self,
        table: str,
        params: dict[str, Any] | None = None,
        auth_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """Query rows from a Supabase table."""
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._get_auth_headers(auth_token)
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, params=params, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Supabase GET {table} failed: {resp.status_code} {resp.text}")
            return resp.json()

    def post(
        self,
        table: str,
        data: dict[str, Any] | list[dict[str, Any]],
        auth_token: str | None = None,
        upsert: bool = False,
        on_conflict: str | None = None,
    ) -> list[dict[str, Any]]:
        """Insert or upsert rows into a Supabase table."""
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._get_auth_headers(auth_token)
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"

        if upsert:
            headers["Prefer"] += ",resolution=merge-duplicates"
            params = {"on_conflict": on_conflict} if on_conflict else None
        else:
            params = None

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=data, params=params, headers=headers)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Supabase POST {table} failed: {resp.status_code} {resp.text}")
            return resp.json() if resp.text else []

    def rpc(
        self,
        function_name: str,
        params: dict[str, Any] | None = None,
        auth_token: str | None = None,
    ) -> Any:
        """Call a Supabase database function via RPC."""
        url = f"{self.base_url}/rest/v1/rpc/{function_name}"
        headers = self._get_auth_headers(auth_token)
        headers["Content-Type"] = "application/json"
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=params or {}, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Supabase RPC {function_name} failed: {resp.status_code} {resp.text}")
            return resp.json()

    def bootstrap_household(self, household_name: str = "कुटुंब भोजन", auth_token: str | None = None) -> str:
        """Obtain or initialize the default household id."""
        return self.rpc("bootstrap_household", {"household_name": household_name}, auth_token=auth_token)


supabase_client = SupabaseClient()
