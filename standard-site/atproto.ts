/**
 * Minimal AT Protocol XRPC client (createSession / putRecord / listRecords /
 * deleteRecord) built on the global fetch — enough to publish standard.site
 * records to a PDS without pulling in the full @atproto/api dependency.
 */

export interface AtpSession {
  did: string;
  handle: string;
  accessJwt: string;
}

/** How many attempts (1 initial + retries) for a transient failure. */
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429 (rate limit) and 5xx (server) responses are worth retrying. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * fetch with retries + exponential backoff for transient conditions (network
 * errors, 429, 5xx). A PDS blip like a 502 should not fail the whole build.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(250 * 2 ** (attempt - 1));
      continue;
    }
    if (isTransientStatus(response.status) && attempt < MAX_ATTEMPTS) {
      await sleep(250 * 2 ** (attempt - 1));
      continue;
    }
    return response;
  }
}

async function xrpc<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetchWithRetry(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`XRPC ${init.method} ${url} failed: ${response.status} ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function createSession(
  pds: string,
  identifier: string,
  password: string,
): Promise<AtpSession> {
  return xrpc<AtpSession>(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
}

function authHeaders(session: AtpSession): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${session.accessJwt}`,
  };
}

/**
 * Create or overwrite a record at a known rkey. `validate: false` skips the
 * PDS Lexicon check, which is required for third-party lexicons like
 * site.standard.* that the PDS does not know natively.
 */
export async function putRecord(
  pds: string,
  session: AtpSession,
  params: { collection: string; rkey: string; record: Record<string, unknown> },
): Promise<void> {
  await xrpc(`${pds}/xrpc/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify({
      repo: session.did,
      collection: params.collection,
      rkey: params.rkey,
      record: params.record,
      validate: false,
    }),
  });
}

/** A blob reference as embedded in a record after uploadBlob. */
export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

/** Upload a binary blob to the repo; returns the blob ref to embed in a record. */
export async function uploadBlob(
  pds: string,
  session: AtpSession,
  bytes: Uint8Array,
  mimeType: string,
): Promise<BlobRef> {
  const response = await fetchWithRetry(`${pds}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      'content-type': mimeType,
      authorization: `Bearer ${session.accessJwt}`,
    },
    // undici accepts a Uint8Array body at runtime; the DOM BodyInit type doesn't list it.
    body: bytes as unknown as BodyInit,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`XRPC uploadBlob failed: ${response.status} ${text}`);
  }
  return (JSON.parse(text) as { blob: BlobRef }).blob;
}

export async function deleteRecord(
  pds: string,
  session: AtpSession,
  collection: string,
  rkey: string,
): Promise<void> {
  await xrpc(`${pds}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify({ repo: session.did, collection, rkey }),
  });
}

export interface AtpRecord {
  uri: string;
  value: Record<string, unknown>;
}

/** List every record in a collection, following pagination cursors. */
export async function listRecords(
  pds: string,
  did: string,
  collection: string,
): Promise<AtpRecord[]> {
  const records: AtpRecord[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({ repo: did, collection, limit: '100' });
    if (cursor) {
      query.set('cursor', cursor);
    }
    const page = await xrpc<{ records: AtpRecord[]; cursor?: string }>(
      `${pds}/xrpc/com.atproto.repo.listRecords?${query.toString()}`,
      { method: 'GET' },
    );
    records.push(...page.records);
    cursor = page.cursor;
  } while (cursor);

  return records;
}

/** The record key is the last path segment of an at:// URI. */
export function rkeyFromUri(uri: string): string {
  return uri.split('/').pop() ?? '';
}
