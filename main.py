import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Minimal static server for local preview (Zero LLM, Zero API dependencies)
app = FastAPI(title="Tron cottage by the Amber stream — Metallic Winter (Static Website)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static asset directories
app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "static", "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "static", "js")), name="js")
app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "static", "data")), name="data")
app.mount("/images", StaticFiles(directory=os.path.join(BASE_DIR, "static", "images")), name="images")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_root():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8008))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
