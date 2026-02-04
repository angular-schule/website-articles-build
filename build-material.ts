import { existsSync } from 'fs';
import { mkdirp } from 'fs-extra';

import { MaterialEntry } from './material.types';
import { copyEntriesToDist, getEntryList } from './base.utils';

const MATERIAL_FOLDER = '../material';
const DIST_FOLDER = './dist';

async function build(): Promise<void> {
  // Graceful exit if material folder doesn't exist (e.g., in angular-schule)
  if (!existsSync(MATERIAL_FOLDER)) {
    console.log('No material folder found, skipping...');
    return;
  }

  await mkdirp(DIST_FOLDER + '/material');

  const materialList = await getEntryList<MaterialEntry>(MATERIAL_FOLDER, '%%MARKDOWN_BASE_URL%%/material/');
  await copyEntriesToDist(materialList, MATERIAL_FOLDER, DIST_FOLDER + '/material');
}

build().catch((error) => {
  console.error('Build material failed:', error);
  process.exit(1);
});
