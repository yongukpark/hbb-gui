# Google Apps Script Sync Setup

This project can use Google Apps Script as the storage backend via `EXTERNAL_SYNC_URL`.

## 1) Create Apps Script Web App

1. Go to `https://script.google.com` and create a new project.
2. Replace `Code.gs` with the script below.
3. Deploy as Web App:
   - Execute as: `Me`
   - Who has access: `Anyone` (or your domain users)
4. Copy the Web App URL.

```javascript
const PROP_KEY = "ANNOTATIONS_JSON";
const SECRET_KEY = "SYNC_SECRET";
const BACKUP_FOLDER_KEY = "BACKUP_FOLDER_ID"; // optional: existing Drive folder id
const BACKUP_LIMIT_KEY = "BACKUP_LIMIT"; // optional: default 50

function emptyProject() {
  const now = new Date().toISOString();
  return {
    modelName: "Pythia-1.4B",
    numLayers: 24,
    numHeads: 16,
    annotations: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function checkSecret(e) {
  const required = PropertiesService.getScriptProperties().getProperty(SECRET_KEY);
  if (!required) return true;
  const token = (e && e.parameter && e.parameter.secret) || "";
  return token === required;
}

function readData() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeData(data) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(data));
}

function getBackupLimit() {
  const raw = PropertiesService.getScriptProperties().getProperty(BACKUP_LIMIT_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.floor(n);
}

function getBackupFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(BACKUP_FOLDER_KEY);
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (_) {}
  }

  const folderName = "headbb-annotations-backups";
  const iter = DriveApp.getFoldersByName(folderName);
  if (iter.hasNext()) {
    const folder = iter.next();
    props.setProperty(BACKUP_FOLDER_KEY, folder.getId());
    return folder;
  }

  const folder = DriveApp.createFolder(folderName);
  props.setProperty(BACKUP_FOLDER_KEY, folder.getId());
  return folder;
}

function snapshotToDrive(currentData) {
  if (!currentData) return;
  const folder = getBackupFolder();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `annotations-backup-${stamp}.json`;
  folder.createFile(name, JSON.stringify(currentData, null, 2), MimeType.PLAIN_TEXT);
  pruneBackups(folder, getBackupLimit());
}

function pruneBackups(folder, limit) {
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    files.push(file);
  }
  files.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  for (let i = limit; i < files.length; i++) {
    files[i].setTrashed(true);
  }
}

function jsonOut(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (!checkSecret(e)) return jsonOut({ error: "unauthorized" });
  const action = (e && e.parameter && e.parameter.action) || "get";
  if (action !== "get") return jsonOut({ error: "invalid_action" });
  return jsonOut(readData() || emptyProject());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonOut({ error: "busy" });
  }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = body.action || "put";
    const secret = body.secret || "";
    const required = PropertiesService.getScriptProperties().getProperty(SECRET_KEY);
    if (required && secret !== required) return jsonOut({ error: "unauthorized" });
    if (action !== "put") return jsonOut({ error: "invalid_action" });

    const current = readData();
    const ifMatch = body.ifMatchUpdatedAt || body.ifMatch || null;
    if (ifMatch && current && current.updatedAt && current.updatedAt !== ifMatch) {
      return jsonOut({ error: "conflict", currentUpdatedAt: current.updatedAt });
    }

    const data = body.data || {};
    const now = new Date().toISOString();
    const payload = Object.assign({}, data, {
      createdAt: data.createdAt || now,
      updatedAt: now,
    });

    snapshotToDrive(current);
    writeData(payload);
    return jsonOut(payload);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
```

## 2) Configure this app

Set environment variables:

```bash
EXTERNAL_SYNC_URL="https://script.google.com/macros/s/xxx/exec"
EXTERNAL_SYNC_SECRET="your-shared-secret"
```

If you use a secret, also set it in Apps Script Script Properties as `SYNC_SECRET`.

Optional Script Properties for Drive backups:

- `BACKUP_FOLDER_ID`: existing Drive folder id (if omitted, script auto-creates `headbb-annotations-backups`)
- `BACKUP_LIMIT`: number of backups to keep (default `50`)

## 3) Verify

`GET /api/annotations` response header should include:

- `x-storage-backend: external`
