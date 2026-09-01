(() => {
    const DATABASE_NAME = "flyback-demo";
    const DATABASE_VERSION = 1;
    const STORE_NAME = "postcards";
    const LATEST_POSTCARD_KEY = "latest";

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB is not supported."));
                return;
            }

            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

            request.addEventListener("upgradeneeded", () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            });
            request.addEventListener("success", () => resolve(request.result));
            request.addEventListener("error", () => reject(request.error));
        });
    }

    async function saveLatestPostcard({ airport, message, photo, createdAt }) {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);

            store.put({
                id: LATEST_POSTCARD_KEY,
                airport,
                message,
                photo,
                createdAt,
            });

            transaction.addEventListener("complete", () => {
                database.close();
                resolve();
            });
            transaction.addEventListener("error", () => {
                database.close();
                reject(transaction.error);
            });
            transaction.addEventListener("abort", () => {
                database.close();
                reject(transaction.error);
            });
        });
    }

    async function getLatestPostcard() {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const request = transaction.objectStore(STORE_NAME).get(LATEST_POSTCARD_KEY);

            request.addEventListener("success", () => resolve(request.result || null));
            request.addEventListener("error", () => reject(request.error));
            transaction.addEventListener("complete", () => database.close());
        });
    }

    window.FlybackDB = {
        saveLatestPostcard,
        getLatestPostcard,
    };
})();
