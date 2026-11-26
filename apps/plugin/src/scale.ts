// The interface scale is a preference of the user's, not of a project: it is
// kept in soundor:storage, shared by every Prism instance, and restored when
// an editor opens. It is stored as the zoom of the reference layout.
import { editorSize, requestEditorSize, subscribeEditorSize, type EditorSize } from 'soundor:ui';
import { storage } from 'soundor:storage';

import { EDITOR_HEIGHT, EDITOR_WIDTH } from './layout';

const KEY = 'interfaceScale';
const MIN_SCALE = 0.75;
const MAX_SCALE = 2;
const SAVE_DELAY_MS = 300;

const zoomOf = (size: EditorSize) => size.width / EDITOR_WIDTH;

function isScale(value: unknown): value is number {
  return typeof value === 'number' && value >= MIN_SCALE && value <= MAX_SCALE;
}

/**
 * Restores the saved scale once the editor has a size, then saves the scale
 * whenever the editor is resized. Returns a function that stops.
 */
export function persistInterfaceScale(): () => void {
  let stopped = false;
  let restored = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saved: number | undefined;

  function restore(size: EditorSize) {
    if (restored || size.width === 0) return;
    restored = true;
    if (!size.resizable || saved === undefined) return;
    if (Math.abs(zoomOf(size) - saved) > 0.005) {
      requestEditorSize(EDITOR_WIDTH * saved, EDITOR_HEIGHT * saved);
    }
  }

  function save(size: EditorSize) {
    if (size.width === 0) return;
    const zoom = zoomOf(size);
    if (!isScale(zoom)) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saved = zoom;
      storage.set(KEY, zoom).catch((error: unknown) => {
        console.warn('Prism could not save the interface scale', error);
      });
    }, SAVE_DELAY_MS);
  }

  let loaded = false;
  const unsubscribe = subscribeEditorSize((size) => {
    if (!loaded) return;
    if (!restored) restore(size);
    else save(size);
  });

  storage
    .get<number>(KEY)
    .catch((error: unknown) => {
      console.warn('Prism could not read the interface scale', error);
      return undefined;
    })
    .then((value) => {
      if (stopped) return;
      saved = isScale(value) ? value : undefined;
      loaded = true;
      restore(editorSize());
    });

  return () => {
    stopped = true;
    clearTimeout(saveTimer);
    unsubscribe();
  };
}
