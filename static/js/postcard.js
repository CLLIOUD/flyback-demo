const form = document.querySelector("#postcard-form");
const airportInput = document.querySelector("#airport");
const photoInput = document.querySelector("#photo");
const messageInput = document.querySelector("#message");
const messageCount = document.querySelector("#message-count");
const photoPreview = document.querySelector("#photo-preview");
const postcardResult = document.querySelector("#postcard-result");
const cardPhoto = document.querySelector("#card-photo");
const cardAirport = document.querySelector("#card-airport");
const cardMessage = document.querySelector("#card-message");
const enablePushButton = document.querySelector("#enable-push");
const testPushButton = document.querySelector("#test-push");
const pushStatus = document.querySelector("#push-status");

let selectedPhoto = "";
let serviceWorkerRegistration = null;

function setPushStatus(message, isError = false) {
    pushStatus.textContent = message;
    pushStatus.classList.toggle("is-error", isError);
}

function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function registerServiceWorker() {
    if (!("Notification" in window)) {
        enablePushButton.disabled = true;
        setPushStatus("이 브라우저는 알림 기능을 지원하지 않습니다.", true);
        return;
    }
    if (!("serviceWorker" in navigator)) {
        enablePushButton.disabled = true;
        setPushStatus("이 브라우저는 Service Worker를 지원하지 않습니다.", true);
        return;
    }
    if (!("PushManager" in window)) {
        enablePushButton.disabled = true;
        setPushStatus("이 브라우저는 PushManager를 지원하지 않습니다.", true);
        return;
    }

    try {
        await navigator.serviceWorker.register("/sw.js?v=4");
        serviceWorkerRegistration = await navigator.serviceWorker.ready;
    } catch (error) {
        enablePushButton.disabled = true;
        setPushStatus("Service Worker 등록에 실패했습니다.", true);
        console.error("Service Worker registration failed:", error);
    }
}

photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];

    if (!file) {
        selectedPhoto = "";
        photoPreview.src = "";
        photoPreview.classList.remove("is-visible");
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        selectedPhoto = reader.result;
        photoPreview.src = selectedPhoto;
        photoPreview.classList.add("is-visible");
    });
    reader.readAsDataURL(file);
});

messageInput.addEventListener("input", () => {
    messageCount.textContent = messageInput.value.length;
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity() || !selectedPhoto) {
        return;
    }

    cardPhoto.src = selectedPhoto;
    cardAirport.textContent = airportInput.value;
    cardMessage.textContent = messageInput.value;
    postcardResult.hidden = false;
    postcardResult.scrollIntoView({ behavior: "smooth", block: "start" });
});

enablePushButton.addEventListener("click", async () => {
    if (!serviceWorkerRegistration) {
        setPushStatus("Service Worker를 준비하지 못했습니다.", true);
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            setPushStatus("알림 권한이 거부되었습니다.", true);
            return;
        }

        const keyResponse = await fetch("/api/push/public-key");
        if (!keyResponse.ok) {
            throw new Error(`VAPID public key request failed: ${keyResponse.status}`);
        }
        const { publicKey } = await keyResponse.json();
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        let subscription = await serviceWorkerRegistration.pushManager.getSubscription();

        if (subscription && !arraysEqual(
            new Uint8Array(subscription.options.applicationServerKey),
            applicationServerKey,
        )) {
            await subscription.unsubscribe();
            subscription = null;
        }

        if (!subscription) {
            subscription = await serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });
        }

        const subscribeResponse = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
        });
        if (!subscribeResponse.ok) {
            throw new Error(`Push subscription request failed: ${subscribeResponse.status}`);
        }

        enablePushButton.hidden = true;
        testPushButton.hidden = false;
        setPushStatus("알림 등록이 완료되었습니다.");
    } catch (error) {
        setPushStatus("알림 구독 등록에 실패했습니다.", true);
        console.error("Push subscription failed:", error);
    }
});

testPushButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/api/push/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ airport: airportInput.value }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Push test failed: ${response.status} ${errorBody}`);
        }

        setPushStatus("테스트 알림을 발송했습니다.");
    } catch (error) {
        setPushStatus("서버 Push 발송에 실패했습니다.", true);
        console.error("Push test failed:", error);
    }
});

registerServiceWorker();
