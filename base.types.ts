/** Image dimensions returned by image-size library */
export interface ImageDimensionsRaw {
  width: number | undefined;
  height: number | undefined;
}

/** Validated image dimensions (always defined) */
export interface ImageDimensions {
  width: number;
  height: number;
}

export interface EntryMetaBase {
  title: string;
  /**
   * ISO 8601 date string (e.g., "2024-01-15T00:00:00.000Z").
   *
   * Note: js-yaml parses unquoted YAML dates as Date objects,
   * but we convert them to ISO strings in markdownToEntry()
   * so the JSON output contains strings (not Date objects).
   */
  published: string;
  lastModified?: string;
  hidden?: boolean;
  sticky?: boolean;
}

export interface EntryBase {
  slug: string;
  html: string;
  meta: EntryMetaBase;
}
