from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.api.planning import router as planning_router
from backend.app.api.meal_change import router as meal_change_router
from backend.app.api.shopping import router as shopping_router
from backend.app.api.tts import router as tts_router

app = FastAPI(title=settings.app_name)

# CORS middleware for browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/api")
@app.get("/hello")
@app.get("/api/hello")
def hello():
    return {
        "ok": True,
        "service": "kutumb-bhojan-api",
        "backend": "fastapi"
    }


# Include routers
app.include_router(planning_router)
app.include_router(meal_change_router)
app.include_router(shopping_router)
app.include_router(tts_router)
