import { ImageDimensions } from "../shared/base.types";

/**
 * Blog entry metadata for the LIGHT list (list.json).
 * Contains only fields needed for blog list display.
 *
 * NOTE: This does NOT extend EntryMetaBase because makeLightBlogList
 * outputs a specific subset of fields.
 */
export interface BlogEntryMeta {
  title: string;
  author: string;
  mail: string;
  published: string;
  language: string;
  header?: ImageDimensions & { url: string };
  // Optional fields (only included if present)
  author2?: string;
  mail2?: string;
  isUpdatePost?: boolean;
}

export interface BlogEntry {
  slug: string;
  html: string;
  meta: BlogEntryMeta;
}

/**
 * Blog entry metadata for the FULL entry (entry.json).
 * Contains all fields with defaults applied by the build process.
 */
export interface BlogEntryFullMeta extends BlogEntryMeta {
  // Fields with defaults (always present in output)
  hidden: boolean;          // default: false
  sticky: boolean;          // default: false
  darkenHeader: boolean;    // default: false (YAML: darken-header)
  // Optional fields
  lastModified?: string;
  bio?: string;
  bio2?: string;
  keywords?: string[];
}

export interface BlogEntryFull extends BlogEntry {
  meta: BlogEntryFullMeta;
}
