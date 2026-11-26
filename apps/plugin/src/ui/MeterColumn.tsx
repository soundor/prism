import { View } from '@soundor/react';

import { GRAPH_HEIGHT, METER_WIDTH } from '../layout';

// Input gain, the stereo output meter with its clip lights, and output gain.
export function MeterColumn() {
  return <View style={{ width: METER_WIDTH, height: GRAPH_HEIGHT, flexShrink: 0 }} />;
}
