import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { expect, test } from 'vitest';

import { FREQUENCY_MAX, FREQUENCY_MIN } from '../../bands/catalog';
import { GRID_POINTS } from '../../graph/response';

// The processor publishes its spectra at the graph's grid frequencies: its
// grid (lib/src/analyzer/grid.rs) has to be this one.
const GRID = fileURLToPath(new URL('../../../lib/src/analyzer/grid.rs', import.meta.url));

test("the processor's analyzer grid is the graph's", () => {
  const source = readFileSync(GRID, 'utf8');
  const constant = (name: string) =>
    Number(new RegExp(`const ${name}: \\w+ = ([\\d_.]+);`).exec(source)?.[1]?.replaceAll('_', ''));
  expect(constant('GRID_POINTS')).toBe(GRID_POINTS);
  expect(constant('FREQUENCY_MIN')).toBe(FREQUENCY_MIN);
  expect(constant('FREQUENCY_MAX')).toBe(FREQUENCY_MAX);
});
