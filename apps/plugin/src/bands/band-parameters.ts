import type { HistoryOptions } from 'soundor:history';
import { parameters } from 'soundor:parameters';

import { bandParameterId, type BandField, type BandSettings } from './catalog';

/** What every band parameter offers, whatever its value type. */
export interface BandParameter<F extends BandField = BandField> {
  get(): BandSettings[F];
  set(value: BandSettings[F], options?: HistoryOptions): void;
  subscribe(listener: () => void): () => void;
  beginGesture(options?: HistoryOptions): void;
  endGesture(): void;
}

/** A slot's parameter for one field: `parameters.band3Gain` for slot 3's gain. */
export function bandParameter<F extends BandField>(slot: number, field: F): BandParameter<F> {
  return (parameters as unknown as Record<string, BandParameter<F>>)[bandParameterId(slot, field)]!;
}
