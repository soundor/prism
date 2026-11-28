import type { PlotBandSamples, PlotSamples, PlotSource } from '@soundor/components';

import type { Band } from '../bands/catalog';
import { getBands, bandsSource } from '../bands/use-bands';
import { phasePoints } from './phase';
import { bandResponse, combine, GRID_POINTS, toPoints, type Response } from './response';

// The curves the graph draws from the bands, as live sources the Plot reads
// when it draws, rather than as props: an edit then redraws the canvas without
// rendering a single view, and only the band that changed is computed again.
// Nothing is computed until a curve is drawn, and the phase only while the
// phase view draws it.

interface Entry {
  key: string;
  /** Computed with the phase, or with zeros in its place. */
  response: Response;
  withPhase: boolean;
  samples: PlotSamples;
}

const shapeKey = (band: Band) =>
  `${band.type}|${band.frequency}|${band.gain}|${band.q}|${band.slope}`;

const zeroPoints = toPoints(new Float64Array(GRID_POINTS));

export function createCurves() {
  const entries = new Map<number, Entry>();
  let bands: readonly Band[] | null = null;
  /** Something draws the phase: compute it with each band's response. */
  let phaseReaders = 0;
  let combined: PlotSamples = { points: zeroPoints };
  let fill: PlotBandSamples = { lower: zeroPoints, upper: zeroPoints };
  let phase: PlotSamples | null = null;

  /** Brings the curves up to date with the bands, and computes the phase if it is wanted. */
  function refresh(withPhase = phaseReaders > 0) {
    const now = getBands();
    if (now === bands && (!withPhase || phase)) return;
    bands = now;
    for (const band of now) {
      const key = shapeKey(band);
      const entry = entries.get(band.slot);
      if (entry && entry.key === key && (entry.withPhase || !withPhase)) continue;
      const response = bandResponse(band, { phase: withPhase });
      const samples = { points: toPoints(response.decibels) };
      entries.set(band.slot, { key, response, withPhase, samples });
    }
    for (const slot of entries.keys())
      if (!now.some((band) => band.slot === slot)) entries.delete(slot);
    const on = now.filter((band) => band.enabled).map((band) => entries.get(band.slot)!.response);
    const sum = combine(on);
    const points = toPoints(sum.decibels);
    combined = { points };
    fill = { lower: zeroPoints, upper: points };
    phase = withPhase ? { points: phasePoints(sum.phase) } : null;
  }

  // A wrapper of its own for each subscription: every series of a Plot
  // subscribes the same function, its controller's invalidate, and the bands
  // keep their listeners in a set, where one unsubscribing would remove all.
  const subscribe = (listener: () => void) => bandsSource.subscribe(() => listener());

  /** One band's own curve. */
  const slotSources = new Map<number, PlotSource<PlotSamples>>();
  function band(slot: number): PlotSource<PlotSamples> {
    let source = slotSources.get(slot);
    if (!source) {
      source = {
        get() {
          refresh();
          return entries.get(slot)?.samples ?? { points: zeroPoints };
        },
        subscribe,
      };
      slotSources.set(slot, source);
    }
    return source;
  }

  return {
    band,
    /** The bands that are on, in series. */
    combined: {
      get() {
        refresh();
        return combined;
      },
      subscribe,
    } satisfies PlotSource<PlotSamples>,
    /** The area between 0 dB and the combined curve. */
    fill: {
      get() {
        refresh();
        return fill;
      },
      subscribe,
    } satisfies PlotSource<PlotBandSamples>,
    /** The combined phase in degrees, wrapped to ±180°. */
    phase: {
      get() {
        refresh(true);
        return phase!;
      },
      subscribe(listener: () => void) {
        phaseReaders++;
        const stop = subscribe(listener);
        return () => {
          phaseReaders--;
          stop();
        };
      },
    } satisfies PlotSource<PlotSamples>,
  };
}

export type Curves = ReturnType<typeof createCurves>;
