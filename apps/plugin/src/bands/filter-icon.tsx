import { Path, Svg } from '@soundor/react/svg';

import type { FilterType } from './catalog';

// Each filter type's response as a small glyph, on the 1.5 px stroke of the
// Lucide icons beside it. No icon set has these.

const shapes: Record<FilterType, string> = {
  bell: 'M1 12 H5 C7.5 12 7.5 3 10 3 S12.5 12 15 12 H19',
  lowShelf: 'M1 4 H6 C9 4 9 12 12 12 H19',
  highShelf: 'M1 12 H8 C11 12 11 4 14 4 H19',
  lowCut: 'M2 15 C4 9 6 5 9 5 H19',
  highCut: 'M1 5 H11 C14 5 16 9 18 15',
  notch: 'M1 5 H7.5 C9 5 9 15 10 15 S11 5 12.5 5 H19',
  bandPass: 'M2 15 C5 15 7 4 10 4 S15 15 18 15',
};

/** A flat line, for a choice of types that differ. */
const flat = 'M1 8 H19';

export function FilterIcon({ type, color }: { type: FilterType | null; color: string }) {
  return (
    <Svg width={20} height={16} viewBox={[0, 0, 20, 16]}>
      <Path
        d={type ? shapes[type] : flat}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
