# TIME CAPSULE FLYBACK

> 여행의 순간을 저장하고 1년 뒤 새로운 지방공항에서 다시 만나는 QR 기반 디지털 타임캡슐 여행 서비스 데모

## Overview

TIME CAPSULE FLYBACK은 공항에서 시작된 여행의 기억을 디지털 엽서로 만들고, 시간이 흐른 뒤 다른 지방공항에서 다시 여행을 이어가는 경험을 제안하는 웹서비스 데모입니다.

PC 또는 공항 디지털 사이니지의 QR 코드에서 모바일 경험이 시작됩니다. 사용자는 스마트폰에서 공항, 사진, 메시지를 선택해 엽서를 미리 보고 Web Push 알림을 등록할 수 있습니다. 데모 알림을 누르면 당시 공항과 일회성 데모 프로모션 코드가 포함된 재방문 화면으로 연결됩니다.

이 프로젝트는 실제 예약·할인 시스템보다 사용자 여정과 핵심 기술의 동작 가능성을 검증하는 데 초점을 두었습니다.

## Service Flow

```text
PC 메인 화면의 QR
        ↓
모바일 디지털 엽서 제작 및 미리보기
        ↓
Service Worker + Web Push 알림 등록
        ↓
12개월 후 알림 체험 발송
        ↓
알림을 통한 재방문
        ↓
타 지방공항 입국 전용 데모 프로모션 코드 확인
```

## Demo 화면

| 메인 이벤트 화면 | 모바일 엽서 제작 |
| --- | --- |
|<img width="2538" height="1419" alt="image" src="https://github.com/user-attachments/assets/e47b5878-72a7-4eb7-8cd7-46d5794474e7" />|
|<img width="603" height="1311" alt="IMG_5403" src="https://github.com/user-attachments/assets/bc76c28e-dab4-47b6-8321-451604773bf0" />|

| Web Push 알림 | 재방문 프로모션 화면 |
| --- | --- |
|<img width="603" height="174" alt="IMG_5386" src="https://github.com/user-attachments/assets/99798a3e-fb53-4664-a7e9-5d02e76c8d9c" />|
|<img width="603" height="1311" alt="IMG_5401" src="https://github.com/user-attachments/assets/58a2d245-9806-4228-b719-dd26ccd3aeed" />|

> 이미지 파일은 추후 `docs/` 디렉터리에 추가할 수 있도록 경로만 지정되어 있습니다.

## Key Features

- 접속 중인 origin을 기준으로 `/postcard` URL을 담은 QR 코드 동적 생성
- 스마트폰 중심의 디지털 엽서 작성 및 브라우저 내 사진 미리보기
- 공항 선택과 최대 200자 메시지를 반영한 포토 엽서 미리보기
- Service Worker, Push API, VAPID를 이용한 실제 Web Push 구독과 알림 수신
- iPhone 홈 화면 웹 앱과 Cloudflare Tunnel HTTPS 환경에서의 모바일 테스트
- 알림 클릭 시 공항과 데모 프로모션 코드를 전달하는 `/return` 화면
- 브라우저 Clipboard API를 이용한 프로모션 코드 복사
- 만료된 Push Subscription 정리와 endpoint 기준 중복 등록 방지

## Architecture

```mermaid
flowchart LR
    A[PC / 디지털 사이니지] -->|동적 QR| B[모바일 /postcard]
    B -->|사진·메시지: 브라우저 DOM에서만 처리| C[엽서 미리보기]
    C -->|알림 등록| D[FastAPI]
    D -->|Subscription 임시 보관| E[(프로세스 메모리)]
    D -->|VAPID Web Push| F[브라우저 Push Service]
    F -->|Push event| G[Service Worker]
    G -->|알림 클릭| H[/return]
    H --> I[데모 프로모션 코드]
```

FastAPI는 페이지 렌더링, QR 이미지 생성, VAPID 공개키 제공, Push Subscription 등록 및 테스트 발송을 담당합니다. 사진과 메시지는 서버로 전송하지 않고 브라우저에서만 미리보기로 사용합니다.

## Tech Stack

| 구분 | 기술 | 역할 |
| --- | --- | --- |
| Backend | Python, FastAPI | 라우팅, 템플릿 응답, QR 및 Web Push API |
| Server | Uvicorn | ASGI 애플리케이션 실행 |
| Template | Jinja2 | 메인·엽서·재방문 페이지 렌더링 |
| Frontend | HTML, CSS, JavaScript | 반응형 UI와 클라이언트 미리보기 |
| Push | Service Worker, Web Push, VAPID | 백그라운드 알림 수신과 재방문 연결 |
| Network | Cloudflare Tunnel | 모바일 외부 접속을 위한 HTTPS 터널 |
| Development | PyCharm, OpenAI Codex, Git | 개발, 구현 지원 및 버전 관리 |

주요 Python 패키지는 FastAPI, Uvicorn, Jinja2, qrcode, Pillow, pywebpush, cryptography입니다.

## Project Structure

```text
flyback-demo/
├─ .gitignore
├─ main.py
├─ requirements.txt
├─ README.md
├─ templates/
│  ├─ index.html
│  ├─ postcard.html
│  └─ return.html
└─ static/
   ├─ manifest.webmanifest
   ├─ sw.js
   ├─ css/
   │  └─ style.css
   ├─ images/
   └─ js/
      ├─ app.js
      ├─ postcard.js
      └─ return.js
```

`.venv`, IDE 설정과 Python 캐시는 `.gitignore`로 제외됩니다. `docs/` 이미지 파일은 아직 프로젝트에 포함되어 있지 않습니다.

## Local 실행 방법

PowerShell과 Python 3.12 환경을 기준으로 합니다.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

브라우저에서 다음 주소를 확인합니다.

- 메인 화면: `http://127.0.0.1:8000/`
- 모바일 엽서: `http://127.0.0.1:8000/postcard`
- 재방문 화면: `http://127.0.0.1:8000/return`

VAPID 키 환경변수가 없으면 서버 프로세스에서만 유효한 개발용 키가 자동 생성됩니다. 서버 재시작 시 메모리의 Subscription과 임시 키가 초기화될 수 있으므로 알림을 다시 등록해야 합니다.

## Cloudflare Tunnel을 통한 모바일 테스트

서버를 실행한 상태에서 별도 터미널에 Cloudflare Tunnel을 시작합니다.

```powershell
cloudflared tunnel --url http://localhost:8000
```

1. 출력된 `https://...trycloudflare.com` 주소로 PC 메인 화면에 접속합니다.
2. 화면의 QR 코드를 스마트폰으로 스캔합니다.
3. iPhone에서는 페이지를 홈 화면에 추가한 뒤 홈 화면 아이콘으로 실행합니다.
4. 엽서를 만들고 `1년 뒤 알림 받기`를 눌러 알림 권한을 허용합니다.
5. `12개월 후 알림 체험`으로 실제 Web Push 수신을 확인합니다.
6. 알림을 누른 뒤 `/return` 프로모션 화면으로 이동하는지 확인합니다.

Service Worker와 Web Push 테스트에는 HTTPS가 필요합니다. Tunnel 주소가 바뀌면 origin도 달라지므로 새 주소에서 다시 홈 화면 추가 및 알림 등록이 필요할 수 있습니다.

## Data Handling

현재 데모는 개인정보와 여행 콘텐츠를 서버에 영구 저장하지 않습니다.

- 이름, 이메일, 전화번호 및 회원정보를 입력받지 않습니다.
- 선택한 사진과 작성한 메시지는 브라우저 DOM과 메모리에서만 사용합니다.
- 사진 업로드, 서버 파일 저장, LocalStorage, SessionStorage, Cookie를 사용하지 않습니다.
- Push Subscription만 FastAPI 프로세스 메모리에 임시 보관합니다.
- 서버를 종료하면 Subscription 정보도 사라집니다.
- 프로모션 코드는 테스트 알림 발송 시 생성하여 Push payload와 재방문 URL에만 사용하며 저장하지 않습니다.

## Demo Scope

현재 구현은 서비스 콘셉트와 기술 흐름을 확인하기 위한 데모입니다.

구현된 범위는 동적 QR, 모바일 엽서 미리보기, Web Push 구독·테스트 발송, 알림 재방문, 데모 프로모션 코드 표시입니다. 실제 12개월 예약, 데이터베이스, 사용자 계정, 사진·메시지 저장, 실제 할인 적용, 항공권 예약, 외부 공항·항공사 API 연동은 포함하지 않습니다.

## 향후 실제 서비스 확장 시 고려사항

- 사용자 동의와 보유 기간 정책을 포함한 Subscription 영속화 및 철회 기능
- VAPID 개인키의 Secret Manager 보관과 운영 환경별 키 관리
- 실제 12개월 발송을 위한 신뢰성 있는 예약 작업과 실패 재시도 체계
- 만료·해지된 Subscription 정리 및 다중 기기 관리
- 개인정보 영향평가, 접근 통제, 암호화, 감사 로그와 운영 모니터링
- 공항·항공사·프로모션 운영 주체와의 정식 API 및 정산 정책 연계
- 접근성, 다국어, 다양한 모바일 브라우저에 대한 품질 검증

## Disclaimer

이 프로젝트의 프로모션 코드는 서비스 시연을 위해 임의 생성되는 데모 코드입니다. 실제 공항, 항공사, 면세점 또는 기타 상업 시설에서 사용할 수 있는 할인코드가 아닙니다.
