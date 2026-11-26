import { Knob, ValueField, type RangeParameter } from '@soundor/components';
import { useRef, useState } from 'react';
import { parameters } from 'soundor:parameters';

import { bandParameterId, type Band } from '../bands/catalog';
import { beginBandsEdit, type BandsEdit } from '../bands/edit';

// A knob and a value field for frequency, gain or Q. One band binds them to
// its parameters. Several bands with one value edit them all to the same
// value; several with different values edit each by the same offset (octaves
// for frequency, dB for gain, a ratio for Q), which the field shows while it
// lasts and "Mixed" otherwise.

export type RangeField = 'frequency' | 'gain' | 'q';

export interface RangeSpec {
  field: RangeField;
  /** What assistive technology calls the field. */
  label: string;
  fieldWidth: number;
  min: number;
  max: number;
  scale: 'log' | 'linear';
  format: (value: number) => string;
  parse: (text: string) => number | null;
  /** Edits of several bands that differ. */
  offset: {
    min: number;
    max: number;
    step: number;
    format: (offset: number) => string;
    parse: (text: string) => number | null;
    /** A band's value moved by `offset` from where it started. */
    apply: (start: number, offset: number) => number;
  };
}

const rangeParameter = (slot: number, field: RangeField) =>
  (parameters as unknown as Record<string, RangeParameter>)[bandParameterId(slot, field)]!;

export function RangeControls({ spec, bands }: { spec: RangeSpec; bands: readonly Band[] }) {
  if (bands.length === 1) return <SingleBand spec={spec} slot={bands[0]!.slot} />;
  return <SeveralBands spec={spec} bands={bands} />;
}

function SingleBand({ spec, slot }: { spec: RangeSpec; slot: number }) {
  const parameter = rangeParameter(slot, spec.field);
  return (
    <>
      <Knob
        parameter={parameter}
        size="sm"
        showLabel={false}
        showValue={false}
        accessibilityLabel={`${spec.label} knob`}
      />
      <ValueField
        parameter={parameter}
        label=""
        width={spec.fieldWidth}
        format={spec.format}
        parse={spec.parse}
        accessibilityLabel={spec.label}
      />
    </>
  );
}

function SeveralBands({ spec, bands }: { spec: RangeSpec; bands: readonly Band[] }) {
  const first = bands[0]![spec.field];
  const common = bands.every((band) => band[spec.field] === first) ? first : null;
  const edit = useRef<BandsEdit | null>(null);
  const [offset, setOffset] = useState<number | null>(null);

  const gesture = {
    onChangeStart: () => {
      edit.current = beginBandsEdit(bands, spec.field, `Change ${spec.label.toLowerCase()}`);
    },
    onChangeEnd: () => {
      edit.current?.end();
      edit.current = null;
      setOffset(null);
    },
  };

  if (common !== null) {
    const props = {
      ...gesture,
      value: common,
      min: spec.min,
      max: spec.max,
      scale: spec.scale,
      onChange: (value: number) => edit.current?.update(() => value),
    };
    return (
      <>
        <Knob
          {...props}
          size="sm"
          showLabel={false}
          showValue={false}
          accessibilityLabel={`${spec.label} knob`}
        />
        <ValueField
          {...props}
          width={spec.fieldWidth}
          format={spec.format}
          parse={spec.parse}
          accessibilityLabel={spec.label}
        />
      </>
    );
  }

  const props = {
    ...gesture,
    mixed: true,
    mixedStart: 0,
    mixedLabel: offset === null ? 'Mixed' : spec.offset.format(offset),
    value: 0,
    min: spec.offset.min,
    max: spec.offset.max,
    step: spec.offset.step,
    onChange: (value: number) => {
      setOffset(value);
      edit.current?.update((start) => spec.offset.apply(start, value));
    },
  };
  return (
    <>
      <Knob
        {...props}
        size="sm"
        showLabel={false}
        showValue={false}
        accessibilityLabel={`${spec.label} offset knob`}
      />
      <ValueField
        {...props}
        width={spec.fieldWidth}
        format={spec.offset.format}
        parse={spec.offset.parse}
        accessibilityLabel={`${spec.label} offset`}
      />
    </>
  );
}
