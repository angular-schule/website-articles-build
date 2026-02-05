import { existsSync } from 'fs';
import * as path from 'path';
import { mkdirp, remove, writeJson } from 'fs-extra';

import { BlogEntryFull } from './blog/blog.types';
import { MaterialEntry } from './material/material.types';
import { copyEntriesToDist, getEntryList } from './shared/base.utils';
import { makeLightBlogList } from './blog/blog.utils';
import { makeLightList } from './shared/list.utils';
import { MARKDOWN_BASE_URL_PLACEHOLDER } from './shared/jekyll-markdown-parser';

const DIST_FOLDER = './dist';
const BLOG_FOLDER = '../blog';
const MATERIAL_FOLDER = '../material';
const LIST_FILE = 'list.json';

/** Apply default values for optional blog YAML fields */
function applyBlogDefaults(entries: BlogEntryFull[]): BlogEntryFull[] {
  return entries.map(entry => ({
    ...entry,
    meta: {
      ...entry.meta,
      hidden: entry.meta.hidden ?? false,
      sticky: entry.meta.sticky ?? false,
      darkenHeader: entry.meta.darkenHeader ?? false,
    },
  }));
}

async function buildBlog(): Promise<void> {
  console.log('Building blog...');
  const blogDist = path.join(DIST_FOLDER, 'blog');
  await mkdirp(blogDist);

  const rawEntryList = await getEntryList<BlogEntryFull>(BLOG_FOLDER, `${MARKDOWN_BASE_URL_PLACEHOLDER}/blog/`);
  const entryList = applyBlogDefaults(rawEntryList);
  const blogListLight = makeLightBlogList(entryList);
  await writeJson(path.join(blogDist, LIST_FILE), blogListLight);
  await copyEntriesToDist(entryList, BLOG_FOLDER, blogDist);
  console.log(`Blog: ${entryList.length} entries processed`);
}

async function buildMaterial(): Promise<void> {
  if (!existsSync(MATERIAL_FOLDER)) {
    console.log('No material folder found, skipping...');
    return;
  }

  console.log('Building material...');
  const materialDist = path.join(DIST_FOLDER, 'material');
  await mkdirp(materialDist);

  const materialList = await getEntryList<MaterialEntry>(MATERIAL_FOLDER, `${MARKDOWN_BASE_URL_PLACEHOLDER}/material/`);
  const materialListLight = makeLightList(materialList);
  await writeJson(path.join(materialDist, LIST_FILE), materialListLight);
  await copyEntriesToDist(materialList, MATERIAL_FOLDER, materialDist);
  console.log(`Material: ${materialList.length} entries processed`);
}

async function build(): Promise<void> {
  console.log('Initializing dist folder...');
  await remove(DIST_FOLDER);
  await mkdirp(DIST_FOLDER);

  await buildBlog();
  await buildMaterial();

  console.log('Build complete!');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
