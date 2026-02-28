/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    // Web
    BASE_URL: string;
    WEB_USER: string;
    WEB_PASS: string;

    // SSH
    USE_SSH_TUNNEL: string;
    SSH_HOST: string;
    SSH_PORT: string;
    SSH_USER: string;
    SSH_PRIVATE_KEY?: string;
    SSH_PASSWORD?: string;

    // MSSQL
    DB_HOST: string;
    DB_PORT: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_ENCRYPT?: string;
  }
}