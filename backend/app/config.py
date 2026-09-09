import os
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "kutumb-bhojan-api"
    supabase_url: str = os.getenv("SUPABASE_URL", "https://wcwwvyreefkrqchfteqp.supabase.co")
    supabase_publishable_key: str = os.getenv(
        "SUPABASE_PUBLISHABLE_KEY",
        "sb_publishable_taMU0Pog_yTgPzuJ5v7MRA_ACsZ-w3r"
    )
    supabase_service_role_key: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY", None)
    sarvam_api_key: str | None = os.getenv("SARVAM_API_KEY", None)
    default_household_name: str = "कुटुंब भोजन"


settings = Settings()
