import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const FINAPP_NAMESPACE = 'finapp.mvp.v1';
const FIXTURE_RELATIVE_PATH = 'e2e/fixtures/finapp.smoke.fixture.json';
const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, '..');
const DEFAULT_FIXTURE_PATH = path.resolve(PROJECT_ROOT, FIXTURE_RELATIVE_PATH);

type SmokeMode = 'fresh' | 'fixture' | 'snapshot';

interface SmokeFixture {
  version: number;
  namespace: string;
  capturedAt: string;
  scenario: {
    accountName: string;
    recurrenceDescription: string;
  };
  records: Record<string, unknown>;
}

interface LocalStorageSnapshot {
  version: number;
  capturedAt: string;
  origin: string;
  storage: Record<string, string>;
}

function getSmokeMode(): SmokeMode {
  if (process.env.SMOKE_MODE === 'fixture') {
    return 'fixture';
  }
  if (process.env.SMOKE_MODE === 'snapshot') {
    return 'snapshot';
  }
  return 'fresh';
}

async function loadFixture(fixturePath: string): Promise<SmokeFixture> {
  const raw = await fs.readFile(fixturePath, 'utf-8');
  const parsed = JSON.parse(raw) as SmokeFixture;

  if (!parsed || parsed.namespace !== FINAPP_NAMESPACE || typeof parsed.records !== 'object') {
    throw new Error(`Fixture invalido em ${fixturePath}.`);
  }

  if (!parsed.scenario?.accountName || !parsed.scenario?.recurrenceDescription) {
    throw new Error(`Fixture sem metadados de scenario em ${fixturePath}.`);
  }

  return parsed;
}

async function ensureFixtureDirectory(fixturePath: string): Promise<void> {
  await fs.mkdir(path.dirname(fixturePath), { recursive: true });
}

async function loadLocalStorageSnapshot(snapshotPath: string): Promise<LocalStorageSnapshot> {
  const raw = await fs.readFile(snapshotPath, 'utf-8');
  const parsed = JSON.parse(raw) as LocalStorageSnapshot;

  if (!parsed || typeof parsed.storage !== 'object') {
    throw new Error(`Snapshot localStorage invalido em ${snapshotPath}.`);
  }

  return parsed;
}

test('smoke mobile: reset/fixture e fluxo critico ate confirmacao e liquidacao', async ({
  page,
}) => {
  const mode = getSmokeMode();
  const fixturePath = process.env.SMOKE_FIXTURE_PATH
    ? path.resolve(PROJECT_ROOT, process.env.SMOKE_FIXTURE_PATH)
    : DEFAULT_FIXTURE_PATH;
  const snapshotPath = process.env.SMOKE_SNAPSHOT_PATH
    ? path.resolve(PROJECT_ROOT, process.env.SMOKE_SNAPSHOT_PATH)
    : path.resolve(PROJECT_ROOT, 'dev-snapshots/localStorage.initial.json');
  const captureFixturePath = process.env.SMOKE_CAPTURE_FIXTURE_PATH
    ? path.resolve(PROJECT_ROOT, process.env.SMOKE_CAPTURE_FIXTURE_PATH)
    : null;
  const captureMode = Boolean(captureFixturePath);

  const timestamp = Date.now();
  const fixedDataset = captureMode;
  const userEmail = fixedDataset ? 'smoke.fixture@finapp.local' : `smoke.${timestamp}@finapp.local`;
  const userPassword = '123456';
  const accountName = fixedDataset ? 'Conta Fixture Disponibilidade' : `Conta Smoke ${timestamp}`;
  const recurrenceDescription = fixedDataset
    ? 'Recorrencia Fixture Entrada'
    : `Recorrencia Smoke ${timestamp}`;
  const todayDay = new Date().getDate();

  if (mode === 'fixture') {
    const fixture = await loadFixture(fixturePath);

    await page.addInitScript(
      ({ namespace, records }: { namespace: string; records: Record<string, unknown> }) => {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith(`${namespace}.`))
          .forEach((key) => window.localStorage.removeItem(key));

        Object.entries(records).forEach(([key, value]) => {
          window.localStorage.setItem(`${namespace}.${key}`, JSON.stringify(value));
        });
      },
      { namespace: fixture.namespace, records: fixture.records },
    );

    await page.goto('/projection');
    await expect(page.getByRole('heading', { name: 'Projecao', exact: true })).toBeVisible();

    await runProjectionConfirmAndSettlementAssertions({
      page,
      accountName: fixture.scenario.accountName,
      recurrenceDescription: fixture.scenario.recurrenceDescription,
    });

    return;
  }

  if (mode === 'snapshot') {
    const snapshot = await loadLocalStorageSnapshot(snapshotPath);
    const entries = Object.entries(snapshot.storage);

    await page.addInitScript((snapshotEntries: Array<[string, string]>) => {
      window.localStorage.clear();
      snapshotEntries.forEach(([key, value]) => {
        window.localStorage.setItem(key, value);
      });
    }, entries);

    await page.goto('/projection');
    await expect(page.getByRole('heading', { name: 'Projecao', exact: true })).toBeVisible();
    await runProjectionSnapshotAssertions({ page });
    return;
  }

  await page.addInitScript((namespace: string) => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`${namespace}.`))
      .forEach((key) => window.localStorage.removeItem(key));
  }, FINAPP_NAMESPACE);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FINAPP' })).toBeVisible();

  await page.getByRole('link', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Criar Conta' })).toBeVisible();

  await page.getByLabel('Email').fill(userEmail);
  await page.getByLabel('Senha').fill(userPassword);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
  await page.locator('#person-name').fill('Usuario Smoke');
  await page.locator('#person-phone').fill('67999999999');
  await page.locator('#control-center-name').fill('Centro Smoke');
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Iniciar tour: contas' }).click();

  await expect(page.getByRole('heading', { name: 'Contas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova conta' }).click();
  await expect(page.getByRole('heading', { name: 'Nova conta' })).toBeVisible();

  await page.getByLabel('Nome da conta').fill(accountName);
  await page.getByLabel('Saldo inicial').fill('150000');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByText('Conta cadastrada com sucesso.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: accountName }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Proximo: cartoes' }).click();
  await expect(page.getByRole('heading', { name: 'Cartoes de Credito' })).toBeVisible();

  await page.getByRole('link', { name: 'Proximo: recorrencias' }).click();
  await expect(page.getByRole('heading', { name: 'Recorrencias', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Nova recorrencia' }).click();
  await page.getByLabel('Descricao').fill(recurrenceDescription);
  await page.getByLabel('Dia do mes (1-31)').fill(String(todayDay));
  await page.getByLabel('Direcao').selectOption('inflow');
  await page.getByLabel('Valor').fill('100000');
  await page.getByRole('button', { name: 'Salvar recorrencia' }).click();
  await expect(page.getByText('Recorrencia salva com sucesso.')).toBeVisible();

  await page.getByRole('link', { name: 'Proximo: projecao' }).click();
  await expect(page.getByRole('heading', { name: 'Projecao', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Atualizar eventos automaticos' }).click();

  if (captureFixturePath) {
    const records = await page.evaluate((namespace: string) => {
      const snapshot: Record<string, unknown> = {};

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const currentKey = window.localStorage.key(index);
        if (!currentKey || !currentKey.startsWith(`${namespace}.`)) {
          continue;
        }

        const shortKey = currentKey.slice(namespace.length + 1);
        const raw = window.localStorage.getItem(currentKey);
        if (raw === null) {
          continue;
        }

        try {
          snapshot[shortKey] = JSON.parse(raw);
        } catch {
          snapshot[shortKey] = raw;
        }
      }

      return snapshot;
    }, FINAPP_NAMESPACE);

    const fixturePayload: SmokeFixture = {
      version: 1,
      namespace: FINAPP_NAMESPACE,
      capturedAt: new Date().toISOString(),
      scenario: {
        accountName,
        recurrenceDescription,
      },
      records,
    };

    await ensureFixtureDirectory(captureFixturePath);
    await fs.writeFile(captureFixturePath, `${JSON.stringify(fixturePayload, null, 2)}\n`, 'utf-8');
  }

  await runProjectionConfirmAndSettlementAssertions({
    page,
    accountName,
    recurrenceDescription,
  });
});

async function runProjectionConfirmAndSettlementAssertions(params: {
  page: Page;
  accountName: string;
  recurrenceDescription: string;
}): Promise<void> {
  const { page, accountName, recurrenceDescription } = params;

  await expect(
    page.getByRole('heading', { name: 'Resumo de saldo projetado de disponibilidades' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Atualizar eventos automaticos' }).click();

  const forecastRow = page
    .locator('li')
    .filter({ hasText: recurrenceDescription })
    .filter({ hasText: 'previsto • recorrência' })
    .first();

  await expect(forecastRow).toBeVisible();
  const targetDate = (await forecastRow.locator('strong').first().innerText()).trim();
  await forecastRow.getByRole('button', { name: 'Confirmar recorrencia' }).click();

  await expect(page.getByRole('heading', { name: 'Confirmar recorrencia prevista' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar compromisso' }).click();
  await expect(page.getByText('Recorrencia confirmada como compromisso com sucesso.')).toBeVisible();

  const confirmedRow = page
    .locator('li')
    .filter({ hasText: recurrenceDescription })
    .filter({ hasText: targetDate })
    .filter({ hasText: 'confirmado • recorrência' })
    .first();

  await expect(confirmedRow).toBeVisible();
  await confirmedRow.getByRole('button', { name: 'Marcar como recebido' }).click();

  await expect(page.getByRole('heading', { name: 'Liquidar compromisso confirmado' })).toBeVisible();
  await page.getByLabel('Conta de disponibilidade').selectOption({ label: accountName });
  await page.getByRole('button', { name: 'Confirmar liquidacao' }).click();
  await expect(page.getByText('Compromisso liquidado e registrado na contabilidade com sucesso.')).toBeVisible();

  await page.getByRole('button', { name: 'Atualizar eventos automaticos' }).click();

  const settledRows = page
    .locator('li')
    .filter({ hasText: recurrenceDescription })
    .filter({ hasText: targetDate });

  await expect(settledRows).toHaveCount(1);
  await expect(settledRows.first().getByText('realizado • recorrência')).toBeVisible();
  await expect(settledRows.first().getByRole('button', { name: 'Confirmar recorrencia' })).toHaveCount(0);

  await expect(
    page.getByRole('heading', { name: 'Resumo de saldo projetado de disponibilidades' }),
  ).toBeVisible();
}

async function runProjectionSnapshotAssertions(params: { page: Page }): Promise<void> {
  const { page } = params;

  await expect(
    page.getByRole('heading', { name: 'Resumo de saldo projetado de disponibilidades' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar eventos automaticos' }).click();

  const forecastRow = page
    .locator('li')
    .filter({ hasText: 'previsto • recorrência' })
    .filter({ has: page.getByRole('button', { name: 'Confirmar recorrencia' }) })
    .first();

  await expect(forecastRow).toBeVisible();
  const recurrenceDescription = (await forecastRow.locator('span').nth(1).innerText()).trim();

  await forecastRow.getByRole('button', { name: 'Confirmar recorrencia' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar recorrencia prevista' })).toBeVisible();
  const today = new Date();
  const todayInput = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  await page.getByLabel('Data do fato/documento').fill(todayInput);
  await page.getByLabel('Data de vencimento').fill(todayInput);
  await page.getByRole('button', { name: 'Confirmar compromisso' }).click();
  await expect(page.getByText('Recorrencia confirmada como compromisso com sucesso.')).toBeVisible();

  const confirmedRow = page
    .locator('li')
    .filter({ hasText: recurrenceDescription })
    .filter({ hasText: 'confirmado • recorrência' })
    .first();
  await expect(confirmedRow).toBeVisible();

  const settleReceived = confirmedRow.getByRole('button', { name: 'Marcar como recebido' });
  const settlePaid = confirmedRow.getByRole('button', { name: 'Marcar como pago' });
  if ((await settleReceived.count()) > 0) {
    await settleReceived.click();
  } else {
    await settlePaid.click();
  }

  await expect(page.getByRole('heading', { name: 'Liquidar compromisso confirmado' })).toBeVisible();
  await page.locator('#settlement-account').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Confirmar liquidacao' }).click();
  await expect(page.getByText('Compromisso liquidado e registrado na contabilidade com sucesso.')).toBeVisible();

  await page.getByRole('button', { name: 'Atualizar eventos automaticos' }).click();
  const settledRow = page
    .locator('li')
    .filter({ hasText: recurrenceDescription })
    .filter({ hasText: 'realizado • recorrência' })
    .first();
  await expect(settledRow.getByText('realizado • recorrência')).toBeVisible();
  await expect(settledRow.getByRole('button', { name: 'Confirmar recorrencia' })).toHaveCount(0);
}
