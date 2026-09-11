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
        if custom_token:
            return {
                "apikey": self.publishable_key,
                "Authorization": f"Bearer {custom_token}",
            }

        if self.service_role_key:
            return {
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            }
        
        token = self._cached_token
        if not token:
            token = self._authenticate_anonymously()

        return {
            "apikey": self.publishable_key,
            "Authorization": f"Bearer {token}",
        }

    def get_user_from_token(self, auth_token: str) -> dict[str, Any] | None:
        """Fetch user profile from Supabase Auth given a bearer token."""
        url = f"{self.base_url}/auth/v1/user"
        headers = {
            "apikey": self.publishable_key,
            "Authorization": f"Bearer {auth_token}",
        }
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            return None

    def verify_household_member(self, household_id: str, auth_token: str | None = None) -> bool:
        """
        Verify if the caller is authorized for the given household.
        Enforces cross-household isolation boundaries even when service-role is used.
        """
        if not household_id:
            return False

        if not auth_token:
            try:
                default_id = self.bootstrap_household()
                return str(default_id).lower() == str(household_id).lower()
            except Exception:
                return False

        # 1. Try RPC with user's JWT token (evaluates Postgres RLS)
        try:
            res = self.rpc("is_household_member", {"target_household": household_id}, auth_token=auth_token)
            if res is True:
                return True
        except Exception:
            pass

        # 2. Server-side lookup using user profile and membership table
        user = self.get_user_from_token(auth_token)
        if not user or "id" not in user:
            return False

        user_id = user["id"]
        rows = self.get("household_members", {
            "household_id": f"eq.{household_id}",
            "user_id": f"eq.{user_id}",
        })
        return len(rows) > 0

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

    def patch(
        self,
        table: str,
        params: dict[str, Any],
        data: dict[str, Any],
        auth_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """Update rows in a Supabase table."""
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._get_auth_headers(auth_token)
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"
        with httpx.Client(timeout=15.0) as client:
            resp = client.patch(url, json=data, params=params, headers=headers)
            if resp.status_code not in (200, 204):
                raise RuntimeError(f"Supabase PATCH {table} failed: {resp.status_code} {resp.text}")
            return resp.json() if resp.text else []

    def delete_by_key(
        self,
        table: str,
        params: dict[str, Any],
        auth_token: str | None = None,
    ) -> None:
        """Delete rows matching params."""
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._get_auth_headers(auth_token)
        with httpx.Client(timeout=15.0) as client:
            resp = client.delete(url, params=params, headers=headers)
            if resp.status_code not in (200, 204):
                raise RuntimeError(f"Supabase DELETE {table} failed: {resp.status_code} {resp.text}")

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
