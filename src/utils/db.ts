import { openDB, DBSchema } from "idb";

interface OCRMeowDB extends DBSchema {
  history: {
    key: number;
    value: {
      id?: number;
      timestamp: number;
      text: string;
      image: string;
      source: string;
    };
    indexes: { "by-timestamp": number };
  };
  assets: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
    };
  };
}

export async function getDB() {
  return openDB<OCRMeowDB>("ocrmeow-db", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("history", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-timestamp", "timestamp");
      }
      if (oldVersion < 2) {
        db.createObjectStore("assets", { keyPath: "id" });
      }
    },
  });
}

export async function saveHistory(text: string, image: string, source: string, limit: number) {
  const db = await getDB();
  const tx = db.transaction("history", "readwrite");
  const store = tx.objectStore("history");

  await store.add({
    timestamp: Date.now(),
    text,
    image,
    source,
  });

  // Enforce history limit
  const count = await store.count();
  if (count > limit) {
    const excess = count - limit;
    let cursor = await store.index("by-timestamp").openCursor();
    for (let i = 0; i < excess && cursor; i++) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export async function getHistory(limit: number = 100) {
  const db = await getDB();
  const tx = db.transaction("history", "readonly");
  const index = tx.objectStore("history").index("by-timestamp");
  let cursor = await index.openCursor(null, "prev"); // newest first
  const results = [];

  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  return results;
}

export async function clearHistory() {
  const db = await getDB();
  const tx = db.transaction("history", "readwrite");
  await tx.objectStore("history").clear();
  await tx.done;
}

// ─── Assets (Models & WASM) ──────────────────────────────────────────

export async function saveAsset(id: string, blob: Blob) {
  const db = await getDB();
  const tx = db.transaction("assets", "readwrite");
  await tx.objectStore("assets").put({
    id,
    blob,
    timestamp: Date.now(),
  });
  await tx.done;
}

export async function getAsset(id: string): Promise<Blob | null> {
  const db = await getDB();
  const record = await db.get("assets", id);
  return record ? record.blob : null;
}

export async function deleteAsset(id: string) {
  const db = await getDB();
  const tx = db.transaction("assets", "readwrite");
  await tx.objectStore("assets").delete(id);
  await tx.done;
}
