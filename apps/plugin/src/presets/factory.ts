import { useParameter, usePresetSelection } from '@soundor/react';
import { useCallback } from 'react';
import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { presets, type FactoryPresetInfo } from 'soundor:presets';
import { state } from 'soundor:state';

import { factoryPresets } from '../../factory-presets';
import { bandFields, defaultBand, MAX_BANDS, type Band, type BandSettings } from '../bands/catalog';
import { clearSelection } from '../bands/selection';
import { allBandsSource } from '../bands/use-bands';
import { useSelector } from '../utils/store';

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

type FactoryPreset = (typeof factoryPresets)[number];
const expected = new Map<FactoryPreset, readonly BandSettings[]>();

/** Each slot as the preset sets it, numbers rounded as the parameters store them. */
function expectedBands(factory: FactoryPreset): readonly BandSettings[] {
  let bands = expected.get(factory);
  if (!bands) {
    bands = Array.from({ length: MAX_BANDS }, (_, i) => {
      const spec = factory.bands[i];
      const band = spec ? { ...defaultBand, ...spec, active: true } : defaultBand;
      return Object.fromEntries(
        bandFields.map((field) => {
          const value = band[field];
          return [field, typeof value === 'number' ? Math.fround(value) : value];
        }),
      ) as unknown as BandSettings;
    });
    expected.set(factory, bands);
  }
  return bands;
}

/**
 * The factory preset loaded, and whether its bands or gains were changed
 * since. It renders when that changes, not at every edit.
 */
export function useFactorySelection() {
  const { factoryId } = usePresetSelection(presets);
  const inputGain = useParameter(parameters.inputGain);
  const outputGain = useParameter(parameters.outputGain);
  const factory = factoryPresets.find((preset) => preset.id === factoryId);
  // Compare only EQ and I/O gain values. Soundor's modified flag also compares
  // persistent state and would mark changes such as display range as edits.
  const bandsChanged = useSelector(
    allBandsSource,
    useCallback(
      (bands: readonly Band[]) =>
        !!factory &&
        bands.some((band, i) => {
          const expected = expectedBands(factory)[i]!;
          return bandFields.some((field) => band[field] !== expected[field]);
        }),
      [factory],
    ),
  );
  const modified = !!factory && (inputGain !== 0 || outputGain !== 0 || bandsChanged);
  return { factoryId, modified };
}
