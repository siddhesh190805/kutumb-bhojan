from fastapi import FastAPI

app = FastAPI(title="kutumb-bhojan-api")


@app.get("/")
@app.get("/hello")
@app.get("/api/hello")
def hello():
    return {
        "ok": True,
        "service": "kutumb-bhojan-api",
        "backend": "fastapi"
    }
