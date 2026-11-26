import { history } from 'soundor:history';

import { bandParameter } from './band-parameters';
import {
  bandFields,
  bandSlots,
  defaultBand,
  type Band,
  type BandField,
  type BandSettings,
} from './catalog';
import { selectOnly } from './selection';

// Band edits, each one undo step. A band is a slot whose `active` parameter is
// on; adding one fills the first free slot, deleting one puts its slot back to
// the defaults.

/** Sets one field on several bands. */
export function setBandsField<F extends BandField>(
  slots: readonly number[],
  field: F,
  value: BandSettings[F],
  label: string,
) {
  history.transaction(label, () => {
    for (const slot of slots) bandParameter(slot, field).set(value);
  });
}

/** The first slot without a band, or null when all of them are in use. */
export function freeSlot(bands: readonly Band[]): number | null {
  const used = new Set(bands.map((band) => band.slot));
  return bandSlots.find((slot) => !used.has(slot)) ?? null;
}

/** Puts a band with the default settings, and any of `settings`, in the first free slot, and selects it. */
export function addBand(
  bands: readonly Band[],
  settings: Partial<BandSettings> = {},
): number | null {
  const slot = freeSlot(bands);
  if (slot === null) return null;
  const band = { ...defaultBand, ...settings, active: true };
  history.transaction('Add band', () => writeSlot(slot, band));
  selectOnly(slot);
  return slot;
}

export function deleteBands(slots: readonly number[]) {
  if (slots.length === 0) return;
  history.transaction(slots.length === 1 ? 'Delete band' : 'Delete bands', () => {
    for (const slot of slots) writeSlot(slot, defaultBand);
  });
}

/** Solos one band, which unsolos any other; or unsolos it. */
export function setSolo(bands: readonly Band[], slot: number, on: boolean) {
  history.transaction(on ? 'Solo band' : 'Unsolo band', () => {
    for (const band of bands) bandParameter(band.slot, 'solo').set(on && band.slot === slot);
  });
}

function writeSlot(slot: number, settings: BandSettings) {
  for (const field of bandFields) bandParameter(slot, field).set(settings[field]);
}

export type ContinuousField = 'frequency' | 'gain' | 'q';

/** A band's continuous settings, or some of them. */
export type ContinuousValues = Partial<Record<ContinuousField, number>>;

/**
 * A drag, a wheel run or a typed value applied to several bands, each from
 * its own starting values: one undo step at the end, labelled `label`.
 *
 * Parameter gestures can each record their own undo step only, so the edit
 * runs inside plain gestures (which tell the host a control is held) and,
 * at the end, is put back and applied again as one transaction.
 */
export function beginBandsMove(
  bands: readonly Band[],
  fields: readonly ContinuousField[],
  label: string,
) {
  const held = bands.flatMap((band) =>
    fields.map((field) => ({ slot: band.slot, field, parameter: bandParameter(band.slot, field) })),
  );
  const start = held.map(({ parameter }) => parameter.get());
  const starts = new Map(bands.map((band) => [band.slot, band]));
  for (const { parameter } of held) parameter.beginGesture();
  let ended = false;
  return {
    /** Sets each band to what `next` gives for its starting settings; fields it leaves out keep theirs. */
    update(next: (start: Band) => ContinuousValues) {
      const values = new Map(bands.map((band) => [band.slot, next(starts.get(band.slot)!)]));
      held.forEach(({ slot, field, parameter }, i) => {
        parameter.set(values.get(slot)![field] ?? start[i]!);
      });
    },
    /** Puts every band back as it was. */
    restore() {
      held.forEach(({ parameter }, i) => parameter.set(start[i]!));
    },
    end() {
      if (ended) return;
      ended = true;
      try {
        const final = held.map(({ parameter }) => parameter.get());
        if (final.some((value, i) => value !== start[i])) {
          held.forEach(({ parameter }, i) => parameter.set(start[i]!));
          history.transaction(label, () => {
            held.forEach(({ parameter }, i) => parameter.set(final[i]!));
          });
        }
      } finally {
        for (const { parameter } of held) parameter.endGesture();
      }
    },
  };
}

export type BandsMove = ReturnType<typeof beginBandsMove>;

/** `beginBandsMove` for one field, given and returning plain numbers. */
export function beginBandsEdit(bands: readonly Band[], field: ContinuousField, label: string) {
  const move = beginBandsMove(bands, [field], label);
  return {
    update(next: (start: number) => number) {
      move.update((band) => ({ [field]: next(band[field]) }));
    },
    end: move.end,
  };
}

export type BandsEdit = ReturnType<typeof beginBandsEdit>;
