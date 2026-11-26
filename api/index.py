import os
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="High Low Buffalo")

COOKIE_NAME = "hlb_access_token"
COOKIE_MAX_AGE = 60 * 60
COOKIE_SECURE = os.getenv("VERCEL") == "1"
PAGE_SIZE = 500


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class DailyEntry(BaseModel):
    entry_date: date
    high: str = Field(max_length=1000)
    low: str = Field(max_length=1000)
    buffalo: str = Field(max_length=1000)


def supabase_config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY "
                "to the server environment."
            ),
        )
    return url, key


def response_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return "The authentication service returned an unexpected response."
    for field in ("msg", "message", "error_description", "error"):
        if isinstance(data, dict) and isinstance(data.get(field), str):
            return data[field]
    return "The authentication service rejected the request."


async def supabase_request(
    method: str,
    endpoint: str,
    *,
    token: str | None = None,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    url, key = supabase_config()
    request_headers = {"apikey": key}
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    if headers:
        request_headers.update(headers)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method,
                f"{url}{endpoint}",
                headers=request_headers,
                json=body,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502, detail="Could not reach the Supabase service."
        ) from exc

    if response.is_error:
        status = response.status_code if response.status_code < 500 else 502
        raise HTTPException(status_code=status, detail=response_message(response))
    return response


async def current_user(request: Request) -> tuple[str, dict[str, Any]]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in.")
    response = await supabase_request(
        "GET", "/auth/v1/user", token=token
    )
    return token, response.json()


def set_auth_cookie(response: Response, access_token: str, expires_in: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        max_age=max(1, min(expires_in, 60 * 60 * 24 * 7)),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/session")
async def session(request: Request, response: Response) -> dict[str, Any]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return {"user": None}
    try:
        _, user = await current_user(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            response.delete_cookie(COOKIE_NAME, path="/", samesite="lax")
            return {"user": None}
        raise
    return {"user": {"id": user["id"], "email": user.get("email", "")}}


@app.post("/api/auth/signup")
async def sign_up(credentials: Credentials, response: Response) -> dict[str, Any]:
    result = await supabase_request(
        "POST",
        "/auth/v1/signup",
        body={"email": credentials.email, "password": credentials.password},
    )
    data = result.json()
    if data.get("access_token"):
        set_auth_cookie(response, data["access_token"], data.get("expires_in", COOKIE_MAX_AGE))
        user = data.get("user") or {}
        return {"user": {"id": user.get("id"), "email": user.get("email", "")}}
    return {"confirmation_required": True}


@app.post("/api/auth/login")
async def log_in(credentials: Credentials, response: Response) -> dict[str, Any]:
    result = await supabase_request(
        "POST",
        "/auth/v1/token?grant_type=password",
        body={"email": credentials.email, "password": credentials.password},
    )
    data = result.json()
    set_auth_cookie(response, data["access_token"], data.get("expires_in", COOKIE_MAX_AGE))
    user = data.get("user") or {}
    return {"user": {"id": user.get("id"), "email": user.get("email", "")}}


@app.post("/api/auth/logout")
async def log_out(request: Request, response: Response) -> dict[str, bool]:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            await supabase_request("POST", "/auth/v1/logout", token=token)
        except HTTPException as exc:
            response.delete_cookie(
                COOKIE_NAME,
                path="/",
                httponly=True,
                secure=COOKIE_SECURE,
                samesite="lax",
            )
            response.status_code = exc.status_code
            return {"detail": exc.detail}
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return {"ok": True}


@app.get("/api/entries")
async def get_entries(request: Request) -> list[dict[str, Any]]:
    token, _ = await current_user(request)
    entries: list[dict[str, Any]] = []
    start = 0
    while True:
        result = await supabase_request(
            "GET",
            f"/rest/v1/daily_entries?select=entry_date,high,low,buffalo&order=entry_date.desc",
            token=token,
            headers={
                "Range-Unit": "items",
                "Range": f"{start}-{start + PAGE_SIZE - 1}",
            },
        )
        page = result.json()
        entries.extend(page)
        if len(page) < PAGE_SIZE:
            return entries
        start += PAGE_SIZE


@app.put("/api/entries")
async def save_entry(entry: DailyEntry, request: Request) -> dict[str, Any]:
    token, user = await current_user(request)
    result = await supabase_request(
        "POST",
        "/rest/v1/daily_entries?on_conflict=user_id,entry_date",
        token=token,
        body={
            "user_id": user["id"],
            "entry_date": entry.entry_date.isoformat(),
            "high": entry.high.strip(),
            "low": entry.low.strip(),
            "buffalo": entry.buffalo.strip(),
        },
        headers={"Prefer": "resolution=merge-duplicates,return=representation"},
    )
    saved = result.json()
    if not saved:
        raise HTTPException(status_code=502, detail="The entry could not be saved.")
    return saved[0]


public_directory = Path(__file__).parent.parent / "public"
if public_directory.is_dir():
    app.mount("/", StaticFiles(directory=public_directory, html=True), name="public")
