import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { createSshTunnel, closeSshTunnel } from '../utils/ssh-tunnel';
import { getDbPool, withTransaction, upsertFeatureFlag, getFeatureFlag } from '../utils/db';

dotenv.config();

test.describe.configure({ mode: 'serial' });

test.describe('E2E with remote MSSQL via SSH', () => {
  let sshHandle: Awaited<ReturnType<typeof createSshTunnel>> | undefined;

  test.beforeAll(async () => {
    if (process.env.USE_SSH_TUNNEL === 'true') {
      sshHandle = await createSshTunnel({
        sshHost: process.env.SSH_HOST!,
        sshPort: Number(process.env.SSH_PORT || '22'),
        sshUser: process.env.SSH_USER!,
        sshPrivateKey: process.env.SSH_PRIVATE_KEY,
        sshPassword: process.env.SSH_PASSWORD,
        dstHost: process.env.DB_HOST!, // MSSQL host as seen from remote machine
        dstPort: Number(process.env.DB_PORT!),
        localPort: 0,
      });
    }
  });

  test.afterAll(async () => {
    if (sshHandle) await closeSshTunnel(sshHandle);
  });

  test('DB change reflected in UI (MSSQL)', async ({ page }) => {
    const dbHost = sshHandle ? '127.0.0.1' : process.env.DB_HOST!;
    const dbPort = sshHandle ? sshHandle.localPort : Number(process.env.DB_PORT!);

    const pool = await getDbPool({
      server: dbHost,
      port: dbPort,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      encrypt: process.env.DB_ENCRYPT === 'true',
    });

    const flagKey = `new_checkout_flow_pw`;

    await withTransaction(pool, async (trx) => {
      await upsertFeatureFlag(trx, flagKey, true);
    });

    // UI flow
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.WEB_USER!);
    await page.getByLabel('Password').fill(process.env.WEB_PASS!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    await page.goto('/checkout');
    await expect(page.getByTestId('new-checkout')).toBeVisible();

    // Optional DB verification
    const flagValue = await getFeatureFlag(pool, flagKey);
    expect(flagValue).toBe(true);

    await pool.close();
  });
});