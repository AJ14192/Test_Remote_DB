// utils/db.ts
import sql from 'mssql';

export type DbConfig = {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  encrypt?: boolean;
};

export async function getDbPool(cfg: DbConfig): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool({
    server: cfg.server,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    options: {
      encrypt: cfg.encrypt ?? false, // true for Azure SQL
      trustServerCertificate: true,  // required for internal servers
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  });

  await pool.connect();
  return pool;
}

/**
 * Run a block inside a SQL Server transaction
 */
export async function withTransaction<T>(
  pool: sql.ConnectionPool,
  fn: (trx: sql.Transaction) => Promise<T>
): Promise<T> {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Example DB operation (replace with real tables)
 */
export async function upsertFeatureFlag(
  trx: sql.Transaction,
  flagKey: string,
  enabled: boolean
) {
  await trx.request()
    .input('flagKey', sql.VarChar, flagKey)
    .input('enabled', sql.Bit, enabled)
    .query(`
      MERGE feature_flags AS target
      USING (SELECT @flagKey AS flag_key) AS source
      ON target.flag_key = source.flag_key
      WHEN MATCHED THEN
        UPDATE SET enabled = @enabled
      WHEN NOT MATCHED THEN
        INSERT (flag_key, enabled)
        VALUES (@flagKey, @enabled);
    `);
}

export async function getFeatureFlag(
  pool: sql.ConnectionPool,
  flagKey: string
): Promise<boolean | undefined> {
  const result = await pool.request()
    .input('flagKey', sql.VarChar, flagKey)
    .query(`
      SELECT enabled
      FROM feature_flags
      WHERE flag_key = @flagKey
    `);

  if (result.recordset.length === 0) return undefined;
  return result.recordset[0].enabled === true;
}