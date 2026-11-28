import os
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="app/templates")

SECRET_KEY = os.getenv("SECRET_KEY", "pudin-secret-key")
ALGORITHM = "HS256"


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    token = request.cookies.get("access_token")
    if not token:
        return None

    if token.startswith("Bearer "):
        token = token.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    return db.query(User).filter(User.id == int(user_id)).first()


@router.get("/login")
def login_page(request: Request, current_user: User | None = Depends(get_optional_current_user)):
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse(request, "login.html")


@router.get("/signup")
def signup_page(request: Request, current_user: User | None = Depends(get_optional_current_user)):
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse(request, "signup.html")


@router.get("/dashboard")
def dashboard_page(request: Request, current_user: User | None = Depends(get_optional_current_user)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {"user": current_user},
    )


@router.get("/workspace/{document_id}")
def workspace_page(
    request: Request,
    document_id: int,
    current_user: User | None = Depends(get_optional_current_user),
):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(
        request,
        "workspace.html",
        {"user": current_user, "document_id": document_id},
    )