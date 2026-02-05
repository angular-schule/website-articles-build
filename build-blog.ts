import * as path from 'path';
import { mkdirp, writeJson } from 'fs-extra';

import { BlogEntryFull } from './blog.types';
import { copyEntriesToDist, getEntryList } from './base.utils';
import { makeLightBlogList } from './blog.utils';
import { MARKDOWN_BASE_URL_PLACEHOLDER } from './jekyll-markdown-parser';

const BLOG_POSTS_FOLDER = '../blog';
const DIST_FOLDER = './dist';
const LIST_FILE = 'list.json';

/** Apply default values and transform YAML field names */
function applyDefaults(entries: BlogEntryFull[]): BlogEntryFull[] {
  return entries.map(entry => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMeta = entry.meta as any;
    return {
      ...entry,
      meta: {
        ...entry.meta,
        hidden: entry.meta.hidden ?? false,
        sticky: entry.meta.sticky ?? false,
        // Transform YAML 'darken-header' to camelCase 'darkenHeader'
        darkenHeader: rawMeta['darken-header'] ?? false,
      },
    };
  });
}

async function build(): Promise<void> {
  const blogDist = path.join(DIST_FOLDER, 'blog');
  await mkdirp(blogDist);

  const rawEntryList = await getEntryList<BlogEntryFull>(BLOG_POSTS_FOLDER, `${MARKDOWN_BASE_URL_PLACEHOLDER}/blog/`);
  const entryList = applyDefaults(rawEntryList);
  const blogListLight = makeLightBlogList(entryList);
  await writeJson(path.join(blogDist, LIST_FILE), blogListLight);
  await copyEntriesToDist(entryList, BLOG_POSTS_FOLDER, blogDist);
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
