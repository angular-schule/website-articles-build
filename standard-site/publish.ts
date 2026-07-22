/**
 * Publishes a site to the standard.site AT Protocol lexicons: one
 * site.standard.publication record and one site.standard.document record per
 * (non-hidden) content entry, written to the configured Bluesky/PDS account.
 *
 * Content sources are generic (e.g. blog posts and material chapters); each is
 * published under its own URL path prefix while sharing the document collection.
 *
 * Publication-agnostic: every account-specific value comes from the environment
 * (see readConfig), so the same shared build serves multiple websites. When the
 * required config is absent the whole step is a no-op, keeping it opt-in.
 */
import { readFile } from 'fs/promises';

import { EntryBase } from '../shared/base.types';
import { extractFirstBigParagraph } from '../shared/list.utils';
import { stripHtmlTags } from '../shared/html.utils';
import {
  AtpSession,
  createSession,
  deleteRecord,
  listRecords,
  putRecord,
  rkeyFromUri,
  uploadBlob,
} from './atproto';

const PUBLICATION_COLLECTION = 'site.standard.publication';
const DOCUMENT_COLLECTION = 'site.standard.document';
const PUBLICATION_RKEY = 'self';

/** A group of content entries published under a common URL path prefix. */
export interface DocumentSource {
  /** URL path segment, e.g. 'blog' or 'material'. */
  contentType: string;
  entries: EntryBase[];
}

interface StandardSiteConfig {
  pds: string;
  handle: string;
  password: string;
  url: string;
  name: string;
  description?: string;
  expectedDid?: string;
  showInDiscover: boolean;
  /** Publication icon: an http(s) URL or a local file path (png/jpg/webp). */
  icon?: string;
  dryRun: boolean;
}

/** Read config from env; returns null when the feature is not configured. */
function readConfig(): StandardSiteConfig | null {
  const password = process.env.BSKY_APP_PASSWORD;
  const handle = process.env.BSKY_HANDLE;
  const url = process.env.STANDARD_SITE_URL;

  if (!password || !handle || !url) {
    return null;
  }

  return {
    pds: process.env.BSKY_PDS || 'https://bsky.social',
    handle,
    password,
    url: url.replace(/\/+$/, ''),
    name: process.env.STANDARD_SITE_NAME || handle,
    description: process.env.STANDARD_SITE_DESCRIPTION || undefined,
    expectedDid: process.env.STANDARD_SITE_EXPECTED_DID || undefined,
    showInDiscover: process.env.STANDARD_SITE_SHOW_IN_DISCOVER !== 'false',
    icon: process.env.STANDARD_SITE_ICON || undefined,
    dryRun: process.env.STANDARD_SITE_DRY_RUN === 'true',
  };
}

/** Guess an image MIME type from a URL or file path. */
function iconMimeType(source: string): string {
  const ext = source.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: throw new Error(`standard.site: unsupported icon type ".${ext}" (${source})`);
  }
}

/** Load icon bytes from an http(s) URL or a local file path. */
async function loadIconBytes(source: string): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`standard.site: cannot fetch icon ${source}: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  return new Uint8Array(await readFile(source));
}

/** Normalise a YAML date (ISO string or date-only) to an ISO 8601 datetime. */
function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function buildDocumentRecord(
  entry: EntryBase,
  contentType: string,
  publicationUri: string,
): Record<string, unknown> {
  const description = stripHtmlTags(extractFirstBigParagraph(entry.html)).trim();
  const record: Record<string, unknown> = {
    $type: DOCUMENT_COLLECTION,
    site: publicationUri,
    title: entry.meta.title,
    path: `/${contentType}/${entry.slug}`,
    publishedAt: toIsoDateTime(entry.meta.published),
    textContent: stripHtmlTags(entry.html),
  };

  if (description) {
    record.description = description;
  }
  if (entry.meta.lastModified) {
    record.updatedAt = toIsoDateTime(entry.meta.lastModified);
  }
  // keywords are blog-specific; present them as tags when available
  const keywords = (entry.meta as { keywords?: string[] }).keywords;
  if (keywords?.length) {
    record.tags = keywords;
  }

  return record;
}

async function upsertPublication(
  config: StandardSiteConfig,
  session: AtpSession,
): Promise<string> {
  const record: Record<string, unknown> = {
    $type: PUBLICATION_COLLECTION,
    url: config.url,
    name: config.name,
    preferences: { showInDiscover: config.showInDiscover },
  };
  if (config.description) {
    record.description = config.description;
  }

  if (config.icon) {
    if (config.dryRun) {
      console.log(`  [dry-run] would upload publication icon from ${config.icon}`);
    } else {
      const bytes = await loadIconBytes(config.icon);
      record.icon = await uploadBlob(config.pds, session, bytes, iconMimeType(config.icon));
    }
  }

  if (config.dryRun) {
    console.log(`  [dry-run] would upsert publication ${PUBLICATION_RKEY} -> ${config.url} (${config.name})`);
  } else {
    await putRecord(config.pds, session, {
      collection: PUBLICATION_COLLECTION,
      rkey: PUBLICATION_RKEY,
      record,
    });
  }

  return `at://${session.did}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`;
}

/** Delete document records whose rkey is no longer a live (non-hidden) slug. */
async function pruneDocuments(
  config: StandardSiteConfig,
  session: AtpSession,
  liveSlugs: Set<string>,
): Promise<number> {
  const existing = await listRecords(config.pds, session.did, DOCUMENT_COLLECTION);
  let pruned = 0;

  for (const record of existing) {
    const rkey = rkeyFromUri(record.uri);
    if (!liveSlugs.has(rkey)) {
      if (config.dryRun) {
        console.log(`  [dry-run] would prune stale document ${rkey}`);
      } else {
        await deleteRecord(config.pds, session, DOCUMENT_COLLECTION, rkey);
      }
      pruned++;
    }
  }

  return pruned;
}

export async function publishStandardSite(sources: DocumentSource[]): Promise<void> {
  const config = readConfig();
  if (!config) {
    console.log('standard.site: not configured (BSKY_APP_PASSWORD/BSKY_HANDLE/STANDARD_SITE_URL), skipping');
    return;
  }

  // Flatten all non-hidden entries across sources. rkey is the slug; blog and
  // material slugs do not overlap, but guard against a collision to be safe.
  const documents: { entry: EntryBase; contentType: string }[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const entry of source.entries) {
      if (entry.meta.hidden) {
        continue;
      }
      if (seen.has(entry.slug)) {
        throw new Error(`standard.site: duplicate document rkey "${entry.slug}" across content types`);
      }
      seen.add(entry.slug);
      documents.push({ entry, contentType: source.contentType });
    }
  }

  console.log(`standard.site: ${config.dryRun ? 'DRY RUN — ' : ''}publishing to ${config.url}`);
  const session = await createSession(config.pds, config.handle, config.password);

  if (config.expectedDid && session.did !== config.expectedDid) {
    throw new Error(
      `standard.site: session DID ${session.did} does not match STANDARD_SITE_EXPECTED_DID ${config.expectedDid}`,
    );
  }

  const publicationUri = await upsertPublication(config, session);

  for (const { entry, contentType } of documents) {
    if (config.dryRun) {
      console.log(`  [dry-run] would write document ${entry.slug} (${contentType})`);
    } else {
      await putRecord(config.pds, session, {
        collection: DOCUMENT_COLLECTION,
        rkey: entry.slug,
        record: buildDocumentRecord(entry, contentType, publicationUri),
      });
    }
  }

  const liveSlugs = new Set(documents.map((doc) => doc.entry.slug));
  const pruned = await pruneDocuments(config, session, liveSlugs);

  const verb = config.dryRun ? 'would publish' : 'published';
  console.log(
    `standard.site: ${verb} 1 publication + ${documents.length} documents, ${config.dryRun ? 'would prune' : 'pruned'} ${pruned} stale`,
  );
}
