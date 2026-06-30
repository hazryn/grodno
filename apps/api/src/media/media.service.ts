import { createHash, createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Presigned URL-e do MinIO/S3 (prywatny bucket). Podpis AWS SigV4 liczony lokalnie
 * (Node crypto) — synchronicznie i bez sieci, więc bez zależności i bez async w toCard.
 * URL-e cache'owane per klucz (stabilne między żądaniami → cache przeglądarki działa).
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly scheme: string;
  private readonly host: string; // np. localhost:5203 — host, którego użyje przeglądarka
  private readonly bucket: string;
  private readonly access: string;
  private readonly secret: string;
  private readonly region: string;
  private readonly expiry = 7 * 24 * 3600; // 7 dni (max dla SigV4)
  private readonly cache = new Map<string, { url: string; exp: number }>();

  constructor() {
    const base = process.env.MEDIA_PUBLIC_BASE ?? 'http://localhost:5203/rodno-media';
    const u = new URL(base);
    this.scheme = u.protocol.replace(':', '');
    this.host = u.host;
    this.bucket = u.pathname.replace(/^\/+/, '').split('/')[0] || 'rodno-media';
    this.access = process.env.MINIO_ACCESS_KEY ?? 'rodno';
    this.secret = process.env.MINIO_SECRET_KEY ?? 'rodno12345';
    this.region = process.env.MINIO_REGION ?? 'us-east-1';
  }

  /** Presigned GET URL dla zapisanego photoUrl (pełny URL) lub gołego klucza. */
  presign(photoUrlOrKey: string | null | undefined): string | null {
    if (!photoUrlOrKey) return null;
    const key = photoUrlOrKey.includes('://')
      ? decodeURIComponent(photoUrlOrKey.split('/').pop() ?? '')
      : photoUrlOrKey;
    if (!key) return null;
    const now = Math.floor(Date.now() / 1000);
    const hit = this.cache.get(key);
    if (hit && hit.exp > now + 300) return hit.url;
    const url = this.sign(key, new Date(now * 1000));
    this.cache.set(key, { url, exp: now + this.expiry });
    return url;
  }

  /** AWS uriEncode (RFC 3986), z zachowaniem '/' opcjonalnie. */
  private enc(s: string, keepSlash = false): string {
    const out = encodeURIComponent(s).replace(
      /[!*'()]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    return keepSlash ? out.replace(/%2F/g, '/') : out;
  }

  private sign(key: string, d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    const amzDate =
      `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
      `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const canonicalUri = `/${this.bucket}/${this.enc(key, true)}`;

    const query = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.access}/${scope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(this.expiry)],
      ['X-Amz-SignedHeaders', 'host'],
    ]
      .map(([k, v]) => `${this.enc(k)}=${this.enc(v)}`)
      .sort()
      .join('&');

    const canonicalRequest = [
      'GET',
      canonicalUri,
      query,
      `host:${this.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
    ].join('\n');

    const hmac = (k: Buffer | string, data: string) =>
      createHmac('sha256', k).update(data, 'utf8').digest();
    const kSigning = hmac(
      hmac(hmac(hmac('AWS4' + this.secret, dateStamp), this.region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', kSigning)
      .update(stringToSign, 'utf8')
      .digest('hex');

    return `${this.scheme}://${this.host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
  }
}
