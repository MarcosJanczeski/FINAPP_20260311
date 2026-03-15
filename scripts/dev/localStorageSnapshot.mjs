import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SNAPSHOT_PATH = path.resolve(PROJECT_ROOT, 'dev-snapshots/localStorage.initial.json');
const DEFAULT_BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

function resolveSnapshotPath() {
  const custom = process.env.LOCALSTORAGE_SNAPSHOT_PATH;
  return custom ? path.resolve(PROJECT_ROOT, custom) : DEFAULT_SNAPSHOT_PATH;
}

async function capture() {
  const snapshotPath = resolveSnapshotPath();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'domcontentloaded' });

  const storage = await page.evaluate(() => {
    const entries = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        entries[key] = value;
      }
    }
    return entries;
  });

  const payload = {
    version: 1,
    capturedAt: new Date().toISOString(),
    origin: DEFAULT_BASE_URL,
    storage,
  };

  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await browser.close();

  console.log(`Snapshot capturado em: ${snapshotPath}`);
  console.log(`Chaves capturadas: ${Object.keys(storage).length}`);
}

async function restore() {
  const snapshotPath = resolveSnapshotPath();
  const raw = await fs.readFile(snapshotPath, 'utf-8');
  const payload = JSON.parse(raw);

  if (!payload || typeof payload !== 'object' || typeof payload.storage !== 'object') {
    throw new Error(`Snapshot inválido: ${snapshotPath}`);
  }

  const entries = Object.entries(payload.storage);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'domcontentloaded' });

  await page.evaluate((snapshotEntries) => {
    window.localStorage.clear();
    for (const [key, value] of snapshotEntries) {
      window.localStorage.setItem(key, String(value));
    }
  }, entries);

  await browser.close();
  console.log(`Snapshot restaurado de: ${snapshotPath}`);
  console.log(`Chaves restauradas: ${entries.length}`);
}

const command = process.argv[2];

if (command === 'capture') {
  await capture();
} else if (command === 'restore') {
  await restore();
} else {
  console.error('Uso: node scripts/dev/localStorageSnapshot.mjs <capture|restore>');
  process.exit(1);
}
