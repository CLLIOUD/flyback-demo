import base64
import json
import logging
import os
import secrets
import string
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from pywebpush import WebPushException, webpush


BASE_DIR = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)

app = FastAPI(title="Time Capsule Flyback Demo")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

templates = Jinja2Templates(directory=BASE_DIR / "templates")

# 데모에서 제공할 공항 목록입니다. 필요할 때 이 목록만 수정하면 됩니다.
AIRPORTS = (
    "김포국제공항",
    "김해국제공항",
    "제주국제공항",
    "청주국제공항",
    "대구국제공항",
)


def create_ephemeral_vapid_keys() -> tuple[str, str]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    private_value = base64.urlsafe_b64encode(private_bytes).rstrip(b"=").decode("ascii")
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_key = base64.urlsafe_b64encode(public_bytes).rstrip(b"=").decode("ascii")
    return private_value, public_key


# 운영 또는 고정 개발 키는 환경변수로 주입합니다. 개인키는 클라이언트에 전달하지 않습니다.
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:developer@example.com")

if bool(VAPID_PRIVATE_KEY) != bool(VAPID_PUBLIC_KEY):
    raise RuntimeError("VAPID_PRIVATE_KEY와 VAPID_PUBLIC_KEY를 함께 설정해야 합니다.")

if not VAPID_PRIVATE_KEY:
    VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY = create_ephemeral_vapid_keys()
    logger.warning(
        "VAPID 환경변수가 없어 이 프로세스에서만 유효한 개발용 키를 생성했습니다."
    )


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=512)
    auth: str = Field(min_length=1, max_length=256)


class PushSubscription(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)
    expirationTime: int | None = None
    keys: SubscriptionKeys


class PushTestRequest(BaseModel):
    airport: str = Field(min_length=1, max_length=50)


# Push Subscription만 프로세스 메모리에 보관하며 서버 종료 시 모두 사라집니다.
subscriptions: list[dict[str, Any]] = []


def generate_promo_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"FLYBACK-{suffix}"


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


@app.get("/postcard", response_class=HTMLResponse)
async def postcard(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="postcard.html",
        context={"airports": AIRPORTS},
    )


@app.get("/return", response_class=HTMLResponse)
async def return_page(
    request: Request,
    airport: str = Query(default="이용 공항", max_length=50),
    code: str = Query(default="FLYBACK-DEMO00", pattern=r"^FLYBACK-[A-Z0-9]{6}$"),
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="return.html",
        context={"airport": airport, "promo_code": code},
    )


@app.get("/sw.js", include_in_schema=False)
async def service_worker() -> FileResponse:
    return FileResponse(
        BASE_DIR / "static" / "sw.js",
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache",
            "Service-Worker-Allowed": "/",
        },
    )


@app.get("/qr")
async def qr_code(
    target: str = Query(min_length=1, max_length=2048),
) -> StreamingResponse:
    image = qrcode.make(target)
    image_bytes = BytesIO()
    image.save(image_bytes, format="PNG")
    image_bytes.seek(0)

    return StreamingResponse(
        image_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/push/public-key")
async def push_public_key() -> dict[str, str]:
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/api/push/subscribe")
async def subscribe(subscription: PushSubscription) -> dict[str, str]:
    subscription_data = subscription.model_dump()
    if not any(item["endpoint"] == subscription.endpoint for item in subscriptions):
        subscriptions.append(subscription_data)
    return {"status": "subscribed"}


@app.post("/api/push/test")
async def test_push(payload: PushTestRequest) -> dict[str, int | str]:
    if payload.airport not in AIRPORTS:
        raise HTTPException(status_code=422, detail="지원하지 않는 공항입니다.")
    if not subscriptions:
        raise HTTPException(status_code=404, detail="등록된 알림 구독이 없습니다.")

    promo_code = generate_promo_code()
    params = urlencode(
        {
            "airport": payload.airport,
            "code": promo_code,
        }
    )
    return_url = f"/return?{params}"
    logging.getLogger("uvicorn.error").info(
        "Web Push target URL: %s",
        return_url,
    )
    notification = json.dumps(
        {
            "title": "TIME CAPSULE FLYBACK",
            "body": f"작년 {payload.airport}에서의 추억이 다른 공항에서 당신을 기다리고 있습니다.",
            "airport": payload.airport,
            "promo_code": promo_code,
            "url": return_url,
        },
        ensure_ascii=False,
    )
    sent_count = 0
    expired_endpoints: set[str] = set()

    for subscription in tuple(subscriptions):
        try:
            await run_in_threadpool(
                webpush,
                subscription_info=subscription,
                data=notification,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent_count += 1
        except WebPushException as error:
            status_code = getattr(error.response, "status_code", None)
            if status_code in {404, 410}:
                expired_endpoints.add(subscription["endpoint"])
            logger.exception("Web Push 발송 실패 (status=%s)", status_code)

    if expired_endpoints:
        subscriptions[:] = [
            item for item in subscriptions if item["endpoint"] not in expired_endpoints
        ]

    if sent_count == 0:
        raise HTTPException(status_code=502, detail="Web Push 발송에 실패했습니다.")

    return {"status": "sent", "sentCount": sent_count}
