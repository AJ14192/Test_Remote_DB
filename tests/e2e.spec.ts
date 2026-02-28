import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { createSshTunnel, closeSshTunnel } from '../utils/ssh-tunnel';
import sql from 'mssql';
import { DbClient } from '../utils/db-client';


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
        sshPrivateKey: process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        sshPassword: process.env.SSH_PASSWORD,
        dstHost: process.env.DB_HOST!,
        dstPort: Number(process.env.DB_PORT!),
        localPort: 0,
      });
    }
  });

  test.afterAll(async () => {
    if (sshHandle) await closeSshTunnel(sshHandle);
  });

  test('DB change reflected in UI (MSSQL)', async ({ page }) => {

    // ✅ Step 1: Decide DB host/port (SSH or direct)
    const dbHost = sshHandle ? '127.0.0.1' : process.env.DB_HOST!;
    const dbPort = sshHandle ? sshHandle.localPort : Number(process.env.DB_PORT!);

    // ✅ Step 2: Create DB client
    const db = new DbClient({
      server: dbHost,
      port: dbPort,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      encrypt: process.env.DB_ENCRYPT === 'true',
    });

    await db.connect();

    // ✅ Step 3: Update DB BEFORE UI login
    await db.query(
      `UPDATE users SET is_active = 1 WHERE email = @email`,
      [
        { name: 'email', type: sql.VarChar, value: process.env.WEB_USER }
      ]
    );

    // ✅ Step 4: UI Flow
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.WEB_USER!);
    await page.getByLabel('Password').fill(process.env.WEB_PASS!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/Dashboard/i)).toBeVisible();

    // Example: verify UI reflects DB change
    await page.goto('/profile');
    await expect(page.getByText('Active User')).toBeVisible();

    // ✅ Optional DB verification
    const result = await db.query(
      `SELECT is_active FROM users WHERE email = @email`,
      [
        { name: 'email', type: sql.VarChar, value: process.env.WEB_USER }
      ]
    );

    expect(result[0].is_active).toBe(true);

    // ✅ Step 5: Close DB connection
    await db.close();
  });
});