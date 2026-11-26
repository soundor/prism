// The reference layout, in logical pixels. The editor zooms it as a whole
// (soundor.config.ts: resize 'scale'), so nothing here adapts to the window.

export const EDITOR_WIDTH = 1200;
export const EDITOR_HEIGHT = 720;

export const HEADER_HEIGHT = 40;
export const FOOTER_HEIGHT = 36;
export const GAP = 8;
export const EDGE = 10;

export const METER_WIDTH = 62;
export const GRAPH_WIDTH = EDITOR_WIDTH - 2 * EDGE - GAP - METER_WIDTH;
export const GRAPH_HEIGHT = 516;
export const INSPECTOR_HEIGHT = 104;
