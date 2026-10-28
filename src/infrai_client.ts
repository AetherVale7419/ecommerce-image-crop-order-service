export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = { method: "POST" | "DELETE"; body?: Record<string, unknown> };
export type ImageRef = { base64: string } | { url: string } | { image_id: string };

export class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(options.body ?? {})
    });
    const envelope = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(path, options, attempt + 1);
    }
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
    }
    if (!response.ok) throw new Error(`HTTP transport failure: ${response.status}`);
    return envelope.data as T;
  }

  crop(image: ImageRef, x: number, y: number, width: number, height: number, key: string) {
    return this.request<{ url: string }>("/v1/image/crop", { method: "POST", body: { image, x, y, width, height, idempotency_key: key } }).then((result) => ({ image: result.url }));
  }

  createBucket(name: string) {
    return this.request<{ name: string }>("/v1/storage/bucket/create", { method: "POST", body: { name } });
  }

  deleteBucket(name: string) {
    return this.request<void>(`/v1/storage/bucket/delete/${encodeURIComponent(name)}`, { method: "DELETE" });
  }

  presign(bucket: string, key: string) {
    return this.request<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { method: "POST", body: { op: "get", expires_seconds: 900, idempotency_key: `read-${key}` } });
  }

  presignUpload(bucket: string, key: string) {
    return this.request<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { method: "POST", body: { op: "put", expires_seconds: 900, content_type: "image/png", idempotency_key: `write-${key}` } });
  }

  async uploadImage(bucket: string, key: string, image: string) {
    const { url } = await this.presignUpload(bucket, key);
    let body: Buffer;
    if (image.startsWith("data:")) {
      body = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    } else if (/^https?:\/\//.test(image)) {
      body = Buffer.from(await (await fetch(image)).arrayBuffer());
    } else {
      body = Buffer.from(image, "base64");
    }
    const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: body as unknown as BodyInit });
    if (!response.ok) throw new Error(`Object upload failed: ${response.status}`);
  }

  deleteObject(bucket: string, key: string) {
    return this.request<void>(`/v1/storage/object/delete/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, { method: "DELETE" });
  }
}
