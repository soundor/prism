import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { state, type CompareSide, type CompareSnapshot } from 'soundor:state';

import { bandParameter } from '../bands/band-parameters';
import { bandFields, bandSlots, defaultBand } from '../bands/catalog';
import { clearSelection } from '../bands/selection';
import { readSlot } from '../bands/use-bands';

export const otherSide = (side: CompareSide) => (side === 'a' ? 'b' : 'a');

function capture(): CompareSnapshot {
  return {
    bands: bandSlots.map((slot) => {
      const { slot: _, ...settings } = readSlot(slot);
      return settings;
    }),
    inputGain: parameters.inputGain.get(),
    outputGain: parameters.outputGain.get(),
  };
}

export function switchCompare(side: CompareSide) {
  if (side === state.compareSide.get()) return;
  history.transaction(`Switch to ${side.toUpperCase()}`, () => {
    const current = capture();
    const other = state.compareOther.get();
    for (const [i, slot] of bandSlots.entries()) {
      const settings = other?.bands[i] ?? defaultBand;
      for (const field of bandFields) bandParameter(slot, field).set(settings[field]);
    }
    parameters.inputGain.set(other?.inputGain ?? 0);
    parameters.outputGain.set(other?.outputGain ?? 0);
    state.compareOther.set(current);
    state.compareSide.set(side);
  });
  clearSelection();
}

export function copyCompare() {
  const side = state.compareSide.get();
  state.compareOther.set(capture(), {
    history: { label: `Copy ${side.toUpperCase()} to ${otherSide(side).toUpperCase()}` },
  });
}
