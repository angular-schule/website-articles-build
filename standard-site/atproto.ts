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

async function xrpc<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
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
