import sql, { ConnectionPool, Transaction } from 'mssql';
import { getDbPool } from './db';

export class DbClient {
  private pool!: ConnectionPool;

  constructor(private config: {
    server: string;
    port: number;
    user: string;
    password: string;
    database: string;
    encrypt?: boolean;
  }) {}

  async connect() {
    this.pool = await getDbPool(this.config);
  }

  async close() {
    await this.pool.close();
  }

  async query<T = any>(query: string, inputs?: { name: string; type: any; value: any }[]): Promise<T[]> {
    const request = this.pool.request();

    if (inputs) {
      for (const input of inputs) {
        request.input(input.name, input.type, input.value);
      }
    }

    const result = await request.query(query);
    return result.recordset as T[];
  }

  async executeInTransaction(fn: (trx: Transaction) => Promise<void>) {
    const trx = new sql.Transaction(this.pool);
    await trx.begin();

    try {
      await fn(trx);
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}