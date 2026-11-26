from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import engine, Base
from app.models import user  # User 모델 등록

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pudin API")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "base.html")