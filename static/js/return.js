const copyButton = document.querySelector("#copy-promotion-code");
const promotionCode = document.querySelector("#promotion-code");
const copyStatus = document.querySelector("#copy-status");
const memoryLoading = document.querySelector("#memory-loading");
const memoryEmpty = document.querySelector("#memory-empty");
const returnPostcardCard = document.querySelector("#return-postcard-card");
const returnCardPhoto = document.querySelector("#return-card-photo");
const returnCardAirport = document.querySelector("#return-card-airport");
const returnCardMessage = document.querySelector("#return-card-message");

let restoredPhotoUrl = "";

async function restoreLatestPostcard() {
    try {
        const postcard = await window.FlybackDB.getLatestPostcard();
        memoryLoading.hidden = true;

        if (!postcard || !(postcard.photo instanceof Blob)) {
            memoryEmpty.hidden = false;
            return;
        }

        restoredPhotoUrl = URL.createObjectURL(postcard.photo);
        returnCardPhoto.src = restoredPhotoUrl;
        returnCardAirport.textContent = postcard.airport;
        returnCardMessage.textContent = postcard.message;
        returnPostcardCard.hidden = false;
    } catch (error) {
        memoryLoading.hidden = true;
        memoryEmpty.hidden = false;
        console.error("Flyback postcard local restore failed:", error);
    }
}

copyButton.addEventListener("click", async () => {
    try {
        if (!navigator.clipboard) {
            throw new Error("Clipboard API is not supported.");
        }

        await navigator.clipboard.writeText(promotionCode.textContent.trim());
        copyStatus.textContent = "프로모션 코드가 복사되었습니다.";
        copyStatus.classList.remove("is-error");
    } catch (error) {
        copyStatus.textContent = "프로모션 코드를 복사하지 못했습니다.";
        copyStatus.classList.add("is-error");
        console.error("Promotion code copy failed:", error);
    }
});

window.addEventListener("pagehide", () => {
    if (restoredPhotoUrl) {
        URL.revokeObjectURL(restoredPhotoUrl);
    }
});

restoreLatestPostcard();
