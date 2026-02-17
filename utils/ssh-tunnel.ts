import { Client } from 'ssh2';

export type TunnelHandle = {
  conn: Client;
  localPort: number;
};

export async function createSshTunnel(options: {
  sshHost: string;           // remote machine public/IP
  sshPort?: number;          // default 22
  sshUser: string;
  sshPrivateKey?: string;    // preferred
  sshPassword?: string;      // fallback
  dstHost: string;           // DB host as seen from remote machine (e.g., 127.0.0.1 or db.internal)
  dstPort: number;           // DB port, e.g., 3306
  localPort?: number;        // 0 => auto assign
}): Promise<TunnelHandle> {
  const {
    sshHost,
    sshPort = 22,
    sshUser,
    sshPrivateKey,
    sshPassword,
    dstHost,
    dstPort,
    localPort = 0,
  } = options;

  const conn = new Client();

  const handle: TunnelHandle = await new Promise((resolve, reject) => {
    conn
      .on('ready', () => {
        // Listen on a local port
        conn.forwardIn('127.0.0.1', localPort, (err, realLocalPort) => {
          if (err) return reject(err);

          // For every local tcp connection, forward to dstHost:dstPort
          conn.on('tcp connection', (info, accept, rejectConn) => {
            const downstream = accept();
            conn.forwardOut('127.0.0.1', info.srcPort, dstHost, dstPort, (err2, upstream) => {
              if (err2) {
                downstream.end();
                return rejectConn();
              }
              downstream.pipe(upstream).pipe(downstream);
            });
          });

          resolve({ conn, localPort: realLocalPort });
        });
      })
      .on('error', reject)
      .connect({
        host: sshHost,
        port: sshPort,
        username: sshUser,
        privateKey: sshPrivateKey,
        password: sshPassword,
        // optional: readyTimeout, keepaliveInterval, keepaliveCountMax
      });
  });

  return handle;
}

export async function closeSshTunnel(handle: TunnelHandle) {
  handle.conn.end();
}