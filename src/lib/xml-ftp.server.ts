/**
 * FTP indirici — beslemenin kaynak dosyasını FTP sunucusundan çeker.
 *
 * Denetim kanalı (USER/PASS/TYPE I/PASV/RETR) doğrudan TCP üzerinden
 * yürütülür; pasif mod veri kanalı ayrı bir bağlantıyla okunur. Şifreler
 * yalnızca sunucuda kullanılır ve hiçbir günlüğe yazılmaz.
 *
 * Desteklenmeyen durumlar açık hata mesajıyla bildirilir:
 * - SFTP (SSH) — bu çalışma ortamında SSH el sıkışması mümkün değil.
 * - FTPS (şifreli FTP) — TLS yükseltmesi desteklenmiyor.
 */

import type { Socket } from "node:net";

import { parseFtpConfig, type FtpConfig } from "@/lib/xml-connection";

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB
const CONNECT_TIMEOUT_MS = 20_000;
const TRANSFER_TIMEOUT_MS = 60_000;

type Reply = { code: number; text: string };

class FtpControl {
  private buffer = "";
  private waiters: Array<(reply: Reply) => void> = [];
  private failure: Error | null = null;

  constructor(private readonly socket: Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => this.consume(chunk));
    socket.on("error", (error: Error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("FTP bağlantısı kapandı")));
  }

  private fail(error: Error) {
    this.failure = error;
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter({ code: -1, text: error.message });
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    for (;;) {
      const match = /^(\d{3})(?: [^\r\n]*)?\r?\n/m.exec(this.buffer);
      // Çok satırlı yanıtlarda son satır "kod boşluk" ile başlar.
      const final = /(^|\n)(\d{3}) [^\r\n]*\r?\n/.exec(this.buffer);
      if (!match || !final) return;
      const end = final.index + final[0].length;
      const text = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end);
      const reply: Reply = { code: Number(final[2]), text: text.trim() };
      const waiter = this.waiters.shift();
      if (waiter) waiter(reply);
    }
  }

  async expect(expected: number[]): Promise<Reply> {
    if (this.failure) throw this.failure;
    const reply = await new Promise<Reply>((resolve) => {
      this.waiters.push(resolve);
    });
    if (reply.code < 0) throw new Error(reply.text);
    if (!expected.includes(Math.floor(reply.code / 100)) && !expected.includes(reply.code)) {
      throw new Error(`FTP sunucusu beklenmeyen yanıt verdi: ${reply.text.slice(0, 200)}`);
    }
    return reply;
  }

  async send(command: string, expected: number[]): Promise<Reply> {
    if (this.failure) throw this.failure;
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  close() {
    try {
      this.socket.write("QUIT\r\n");
    } catch {
      /* bağlantı zaten kapanmış olabilir */
    }
    this.socket.destroy();
  }
}

async function connect(host: string, port: number): Promise<Socket> {
  const net = await import("node:net");
  return new Promise<Socket>((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`FTP sunucusuna ${CONNECT_TIMEOUT_MS / 1000} saniyede bağlanılamadı`));
    }, CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(new Error(`FTP bağlantı hatası: ${error.message}`));
    });
  });
}

/** 227 yanıtından pasif mod veri kanalı adresini okur. */
function parsePasv(text: string): { host: string; port: number } {
  const match = /(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})/.exec(text);
  if (!match) throw new Error("FTP pasif mod adresi okunamadı");
  const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  const port = Number(match[5]) * 256 + Number(match[6]);
  return { host, port };
}

function readAll(socket: Socket): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("FTP dosya aktarımı zaman aşımına uğradı (60 saniye)"));
    }, TRANSFER_TIMEOUT_MS);
    socket.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        clearTimeout(timer);
        socket.destroy();
        reject(new Error("Kaynak dosya 40 MB sınırını aşıyor"));
        return;
      }
      chunks.push(chunk);
    });
    socket.once("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    socket.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(new Error(`FTP veri kanalı hatası: ${error.message}`));
    });
  });
}

export type FtpFetchResult = { content: string; bytes: number; filePath: string };

/**
 * FTP sunucusundaki dosyayı indirir. connectionType "sftp" ise bu ortamda
 * desteklenmediği açıkça bildirilir.
 */
export async function fetchFromFtp(
  rawConfig: unknown,
  connectionType: "ftp" | "sftp" = "ftp",
): Promise<FtpFetchResult> {
  const config: FtpConfig = parseFtpConfig(rawConfig);

  if (connectionType === "sftp") {
    throw new Error(
      "SFTP (SSH) bağlantısı bu ortamda desteklenmiyor. Tedarikçiden FTP, HTTPS adresi veya webhook gönderimi isteyin.",
    );
  }
  if (config.ssl) {
    throw new Error(
      "Şifreli FTP (FTPS) bu ortamda desteklenmiyor. Düz FTP, HTTPS adresi veya webhook gönderimi kullanın.",
    );
  }
  if (!config.host) throw new Error("FTP sunucu adresi girilmedi");
  if (!config.username) throw new Error("FTP kullanıcı adı girilmedi");
  if (!config.filePath) throw new Error("İndirilecek dosya yolu girilmedi");
  if (!config.passive) {
    throw new Error("FTP yalnızca pasif modda kullanılabilir; besleme ayarında pasif modu açın.");
  }

  const socket = await connect(config.host, config.port);
  const control = new FtpControl(socket);

  try {
    await control.expect([2]);
    const userReply = await control.send(`USER ${config.username}`, [2, 3]);
    if (Math.floor(userReply.code / 100) === 3) {
      await control.send(`PASS ${config.password}`, [2]);
    }
    await control.send("TYPE I", [2]);
    const pasv = await control.send("PASV", [227]);
    const target = parsePasv(pasv.text);

    const dataSocket = await connect(target.host, target.port);
    const download = readAll(dataSocket);
    await control.send(`RETR ${config.filePath}`, [1, 2]);
    const buffer = await download;
    await control.expect([2]);

    if (buffer.byteLength === 0) {
      throw new Error(`FTP sunucusunda dosya boş veya bulunamadı: ${config.filePath}`);
    }

    return {
      content: new TextDecoder("utf-8").decode(buffer),
      bytes: buffer.byteLength,
      filePath: config.filePath,
    };
  } finally {
    control.close();
  }
}
