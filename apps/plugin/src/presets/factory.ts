import { useParameter, usePresetSelection } from '@soundor/react';
import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { presets, type FactoryPresetInfo } from 'soundor:presets';
import { state } from 'soundor:state';

import { factoryPresets } from '../../factory-presets';
import { bandFields, defaultBand } from '../bands/catalog';
import { clearSelection } from '../bands/selection';
import { useAllBands } from '../bands/use-bands';

export function loadFactoryPreset(preset: FactoryPresetInfo) {
  const view = {
    analyzerFftSize: state.analyzerFftSize.get(),
    analyzerFloor: state.analyzerFloor.get(),
    analyzerMode: state.analyzerMode.get(),
    analyzerPeakHold: state.analyzerPeakHold.get(),
    analyzerSmoothing: state.analyzerSmoothing.get(),
    analyzerSpeed: state.analyzerSpeed.get(),
    analyzerTilt: state.analyzerTilt.get(),
    analyzerWindow: state.analyzerWindow.get(),
    displayMode: state.displayMode.get(),
    displayRange: state.displayRange.get(),
    showKeyboard: state.showKeyboard.get(),
    showSpectrogram: state.showSpectrogram.get(),
  };
  history.transaction(`Load ${preset.name}`, () => {
    // The factory load resets A/B. Restore just the view in the same transaction,
    // so the graph never briefly renders the preset's default view.
    presets.factory.load(preset.id);
    state.analyzerFftSize.set(view.analyzerFftSize);
    state.analyzerFloor.set(view.analyzerFloor);
    state.analyzerMode.set(view.analyzerMode);
    state.analyzerPeakHold.set(view.analyzerPeakHold);
    state.analyzerSmoothing.set(view.analyzerSmoothing);
    state.analyzerSpeed.set(view.analyzerSpeed);
    state.analyzerTilt.set(view.analyzerTilt);
    state.analyzerWindow.set(view.analyzerWindow);
    state.displayMode.set(view.displayMode);
    state.displayRange.set(view.displayRange);
    state.showKeyboard.set(view.showKeyboard);
    state.showSpectrogram.set(view.showSpectrogram);
  });
  clearSelection();
}

export function useFactorySelection() {
  const { factoryId } = usePresetSelection(presets);
  const bands = useAllBands();
  const inputGain = useParameter(parameters.inputGain);
  const outputGain = useParameter(parameters.outputGain);
  const factory = factoryPresets.find((preset) => preset.id === factoryId);
  // Compare only EQ and I/O gain values. Soundor's modified flag also compares
  // persistent state and would mark changes such as display range as edits.
  const modified =
    !!factory &&
    (inputGain !== 0 ||
      outputGain !== 0 ||
      bands.some((band, i) => {
        const spec = factory.bands[i];
        const expected = spec ? { ...defaultBand, ...spec, active: true } : defaultBand;
        return bandFields.some((field) => {
          const value = expected[field];
          return band[field] !== (typeof value === 'number' ? Math.fround(value) : value);
        });
      }));
  return { factoryId, modified };
}
