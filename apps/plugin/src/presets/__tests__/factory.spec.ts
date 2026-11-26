import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { presets } from 'soundor:presets';
import { state } from 'soundor:state';
import { expect, test } from 'vitest';

import { switchCompare } from '../compare';
import { loadFactoryPreset } from '../factory';

test('loading a factory preset preserves the view, resets A/B, and undoes as one edit', () => {
  state.displayRange.set('db24');
  state.analyzerMode.set('off');
  state.showKeyboard.set(true);
  parameters.inputGain.set(3);
  switchCompare('b');
  parameters.outputGain.set(-4);

  loadFactoryPreset({ id: 'vocal-presence', name: 'Vocal Presence' });
  expect(state.displayRange.get()).toBe('db24');
  expect(state.analyzerMode.get()).toBe('off');
  expect(state.showKeyboard.get()).toBe(true);
  expect(state.compareSide.get()).toBe('a');
  expect(state.compareOther.get()).toBeNull();
  expect(parameters.band1Frequency.get()).toBe(85);
  expect(parameters.outputGain.get()).toBe(0);
  expect(history.undoLabel()).toBe('Load Vocal Presence');

  history.undo();
  expect(presets.getSnapshot().factoryId).toBe('init');
  expect(state.compareSide.get()).toBe('b');
  expect(state.compareOther.get()?.inputGain).toBe(3);
  expect(parameters.outputGain.get()).toBe(-4);

  history.redo();
  expect(presets.getSnapshot().factoryId).toBe('vocal-presence');
  expect(state.displayRange.get()).toBe('db24');
  expect(state.compareOther.get()).toBeNull();
});
