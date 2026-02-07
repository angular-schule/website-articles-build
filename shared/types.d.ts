declare module 'marked-gfm-heading-id' {
  import type { MarkedExtension } from 'marked';

  interface GfmHeadingIdOptions {
    prefix?: string;
  }

  export interface HeadingData {
    level: number;
    text: string;
    raw: string;
    id: string;
  }

  export function gfmHeadingId(options?: GfmHeadingIdOptions): MarkedExtension;
  export function getHeadingList(): HeadingData[];
  export function resetHeadings(): void;
}
