from fastapi import FastAPI

app = FastAPI(title="kutumb-bhojan-api")


@app.get("/api/hello")
@app.get("/")
def hello():
    return {
        "ok": True,
        "service": "kutumb-bhojan-api",
        "backend": "fastapi"
    }
