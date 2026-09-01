const qrImage = document.querySelector("#postcard-qr");

if (qrImage) {
    const postcardUrl = `${window.location.origin}/postcard`;
    qrImage.src = `/qr?target=${encodeURIComponent(postcardUrl)}`;
}
