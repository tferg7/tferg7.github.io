let db;
// create a new db request 
const request = indexedDB.open("budget", 1);

request.onupgradeneeded = function (event) {

    const db = event.target.result;
    db.createObjectStore("money", {autoIncrement: true});
};

request.onsuccess = function (event) {
        db = event.target.result;

        if (navigator.onLine) {
            checkDatabase();
        }
    };

request.onerror = function (event) {
    console.log("Error! " + event.target.errorCode);
};

function saveRecord(record) {

    const transaction = db.transaction(["money"], "readwrite");

    const store = transaction.objectStore("money");

    store.add(record);
}

// guards against two syncs at once (e.g. page load and the "online" event together)
let syncing = false;

function checkDatabase() {
    // no server to sync with in demo mode (GitHub Pages)
    if (typeof DEMO_MODE !== "undefined" && DEMO_MODE) return;
    if (syncing || !db) return;
    syncing = true;

    const transaction = db.transaction(["money"], "readwrite");

    const store = transaction.objectStore("money");

    const getAll = store.getAll();

    getAll.onsuccess = function () {
        if (getAll.result.length === 0) {
            syncing = false;
            return;
        }
        fetch("/api/transaction/bulk", {
            method: "POST",
            body: JSON.stringify(getAll.result),
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json"
            }
        })
            .then(response => {
                if (!response.ok) throw new Error("Bulk upload failed");
                return response.json();
            })
            .then(() => {
                // records are on the server now, so clear the offline store
                const transaction = db.transaction(["money"], "readwrite");
                const store = transaction.objectStore("money");
                store.clear();
            })
            .catch(err => console.log("Will retry offline sync later", err))
            .finally(() => {
                syncing = false;
            });
    };
}

// listen for app coming back online
window.addEventListener("online", checkDatabase);