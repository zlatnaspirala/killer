// maps/index.js
// AAA Map Registry & Data Exporter for Arena Maps & Catalogs
import { generateStairs } from './utils.js';
import { ELEMENTAL_ITEMS_CATALOG, FILAMENT_MATERIALS_CATALOG } from './catalog.js';
import { mapQ3DM17 } from './q3dm17.js';
import { mapZTN } from './ztn.js';

export const MAP_DEFINITIONS = {
  q3dm17: mapQ3DM17,
  ztn: mapZTN
};

export const QUAKE_MAP_DEFINITIONS = MAP_DEFINITIONS;

export function getMap(mapId) {
  return MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS['q3dm17'];
}

export function getAllMapKeys() {
  return Object.keys(MAP_DEFINITIONS);
}

export {
  generateStairs,
  ELEMENTAL_ITEMS_CATALOG,
  FILAMENT_MATERIALS_CATALOG,
  mapQ3DM17,
  mapZTN
};
