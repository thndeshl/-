import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import Base, engine
from app.models import user  # User 모델 등록
from app.routers import auth
from app.routers import auth, pages

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pudin API")

SECRET_KEY = os.getenv("SECRET_KEY", "pudin-secret-key")

app.include_router(auth.router)
app.include_router(pages.router)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "base.html")