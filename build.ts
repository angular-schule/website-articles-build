import { existsSync } from 'fs';
import * as path from 'path';
import { copy, mkdirp, remove, writeJson } from 'fs-extra';

import { BlogEntryFull } from './blog/blog.types';
import { MaterialEntry } from './material/material.types';
import { copyEntriesToDist, getEntryList } from './shared/base.utils';
import { makeLightBlogList } from './blog/blog.utils';
import { makeLightList } from './shared/list.utils';
import { MARKDOWN_BASE_URL_PLACEHOLDER } from './shared/jekyll-markdown-parser';
import { printValidationResults } from './shared/link-validator';
import { publishStandardSite } from './standard-site/publish';

const DIST_FOLDER = '../dist';
const BLOG_FOLDER = '../blog';
const MATERIAL_FOLDER = '../material';
const REDIRECTS_FILE = '../redirects.json';
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

async function buildBlog(): Promise<BlogEntryFull[]> {
  console.log('Building blog...');
  const blogDist = path.join(DIST_FOLDER, 'blog');
  await mkdirp(blogDist);

  const rawEntryList = await getEntryList<BlogEntryFull>(BLOG_FOLDER, `${MARKDOWN_BASE_URL_PLACEHOLDER}/blog/`);
  const entryList = applyBlogDefaults(rawEntryList);
  // Copy + optimize images first: this rewrites header/html references to WebP in
  // place, so the light list.json (written afterwards) references the WebP too.
  await copyEntriesToDist(entryList, BLOG_FOLDER, blogDist);
  const blogListLight = makeLightBlogList(entryList);
  await writeJson(path.join(blogDist, LIST_FILE), blogListLight);
  console.log(`Blog: ${entryList.length} entries processed`);
  return entryList;
}

async function buildMaterial(): Promise<MaterialEntry[]> {
  if (!existsSync(MATERIAL_FOLDER)) {
    console.log('No material folder found, skipping...');
    return [];
  }

  console.log('Building material...');
  const materialDist = path.join(DIST_FOLDER, 'material');
  await mkdirp(materialDist);

  const materialList = await getEntryList<MaterialEntry>(MATERIAL_FOLDER, `${MARKDOWN_BASE_URL_PLACEHOLDER}/material/`);
  await copyEntriesToDist(materialList, MATERIAL_FOLDER, materialDist);
  const materialListLight = makeLightList(materialList);
  await writeJson(path.join(materialDist, LIST_FILE), materialListLight);
  console.log(`Material: ${materialList.length} entries processed`);
  return materialList;
}

/**
 * Serve the repository's redirect map next to the article data. The file maps a
 * renamed entry folder to its current name; consumers resolve it themselves.
 * Optional: a repository without renames has no such file.
 */
async function copyRedirects(): Promise<void> {
  if (!existsSync(REDIRECTS_FILE)) {
    console.log('No redirects.json found, skipping...');
    return;
  }

  console.log('Copying redirects...');
  await copy(REDIRECTS_FILE, path.join(DIST_FOLDER, path.basename(REDIRECTS_FILE)));
}

async function build(): Promise<void> {
  console.log('Initializing dist folder...');
  await remove(DIST_FOLDER);
  await mkdirp(DIST_FOLDER);

  const blogEntries = await buildBlog();
  const materialEntries = await buildMaterial();
  await copyRedirects();

  // Validate all anchor links (warnings only, does not fail build)
  console.log('\nValidating anchor links...');
  printValidationResults();

  // Publish standard.site records (no-op unless configured via env). This is a
  // secondary side-effect: a publish failure must never block the article-data
  // build/deploy, so it is caught and logged rather than thrown.
  try {
    await publishStandardSite([
      { contentType: 'blog', entries: blogEntries, distDir: path.join(DIST_FOLDER, 'blog') },
      { contentType: 'material', entries: materialEntries },
    ]);
  } catch (error) {
    console.error(
      'standard.site: publishing failed (continuing build):',
      error instanceof Error ? error.message : error,
    );
  }

  console.log('\nBuild complete!');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
