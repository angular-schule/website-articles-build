import { existsSync } from 'fs';
import { mkdirp, writeJson } from 'fs-extra';

import { MaterialEntry } from './material.types';
import { copyEntriesToDist, getEntryList } from './base.utils';
import { makeLightList } from './list.utils';

const MATERIAL_FOLDER = '../material';
const DIST_FOLDER = './dist';

async function build(): Promise<void> {
  // Graceful exit if material folder doesn't exist (e.g., in angular-schule)
  if (!existsSync(MATERIAL_FOLDER)) {
    console.log('No material folder found, skipping...');
    return;
  }

  const materialDist = DIST_FOLDER + '/material';
  await mkdirp(materialDist);

  const materialList = await getEntryList<MaterialEntry>(MATERIAL_FOLDER, '%%MARKDOWN_BASE_URL%%/material/');
  const materialListLight = makeLightList(materialList);
  await writeJson(materialDist + '/list.json', materialListLight);
  await copyEntriesToDist(materialList, MATERIAL_FOLDER, materialDist);
}

build().catch((error) => {
  console.error('Build material failed:', error);
  process.exit(1);
});
