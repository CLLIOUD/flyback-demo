const copyButton = document.querySelector("#copy-promotion-code");
const promotionCode = document.querySelector("#promotion-code");
const copyStatus = document.querySelector("#copy-status");

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
