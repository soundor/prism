import { SegmentedControl, Select, type SelectOption } from '@soundor/components';
import { textStyle, ThemeProvider, useTheme } from '@soundor/components/theme';
import { MousePointer2 } from '@soundor/icons/lucide';
import { Text, View } from '@soundor/react';
import { memo } from 'react';

import { EDGE, GAP, INSPECTOR_HEIGHT } from '../app/layout';
import {
  channelBadges,
  channels,
  filterTypeLabel,
  filterTypes,
  hasGain,
  hasQ,
  hasSlope,
  qMeaning,
  slopeDecibels,
  slopes,
  type Band,
  type Channel,
  type FilterType,
  type Slope,
} from '../bands/catalog';
import { setBandsField } from '../bands/edit';
import { FilterIcon } from '../bands/filter-icon';
import { getSelection, useSelectionShapes } from '../bands/selection';
import { bandsSource } from '../bands/use-bands';
import { useSelector } from '../utils/store';
import { Actions } from './actions';
import { BandStrip } from './band-strip';
import { Cell, CellDivider, CONTROL_HEIGHT, NotUsed } from './cells';
import { Identity } from './identity';
import { RangeControls, type RangeSpec } from './range-cell';
import { frequencySpec, gainSpec, qSpec } from './range-specs';

/** Knobs that fit the 40 px control row. */
const compact = { size: { knobSm: 38 } };

/** SegmentedControl with five equal segments, as tall as the other controls. */
const compactSegments = {
  root: { padding: 2 },
  segment: { height: CONTROL_HEIGHT - 6, width: 28, minWidth: 0, paddingHorizontal: 0 },
  label: { fontSize: 10.5 },
} as const;

// The persistent band inspector: the band strip, then one row of parameter
// cells whose positions never change. With nothing selected the row says how
// to select a band instead.
//
// It renders for what the cells show, not for frequency, gain or Q: a drag
// on the graph renders none of it. Those values come from the knobs and fields
// bound to the parameters, or for several bands from RangeControls itself.
export function Inspector() {
  const theme = useTheme();
  const selection = useSelectionShapes();
  return (
    <View
      style={{
        height: INSPECTOR_HEIGHT,
        flexShrink: 0,
        marginTop: GAP,
        marginHorizontal: EDGE,
        borderRadius: theme.radius.radiusLg,
        borderWidth: theme.size.borderHairline,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surfaceElevated,
        overflow: 'hidden',
      }}
    >
      <BandStrip />
      <View style={{ height: 1, backgroundColor: theme.color.divider }} />
      {selection.length === 0 ? <NothingSelected /> : <Cells bands={selection} />}
    </View>
  );
}

const isEmpty = (bands: readonly Band[]) => bands.length === 0;

function NothingSelected() {
  const theme = useTheme();
  const empty = useSelector(bandsSource, isEmpty);
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <MousePointer2 size={16} color={theme.color.textMuted} strokeWidth={1.6} />
      <Text style={textStyle(theme, 'title', theme.color.text)}>
        {empty ? 'Add a band to start' : 'Select a band to edit it'}
      </Text>
      <Text style={textStyle(theme, 'caption', theme.color.textSecondary)}>
        {empty
          ? 'Double-click anywhere on the graph, or press Add'
          : 'Click a marker or a chip above · Shift-click or drag on the graph to select several'}
      </Text>
    </View>
  );
}

/** The value all the bands share, or null when they differ. */
function common<K extends keyof Band>(bands: readonly Band[], key: K): Band[K] | null {
  const first = bands[0]![key];
  return bands.every((band) => band[key] === first) ? first : null;
}

const typeOptions: SelectOption<FilterType>[] = filterTypes.map(({ value, label }) => ({
  value,
  label,
  icon: ({ color }) => <FilterIcon type={value} color={color} />,
}));

const slopeOptions = slopes.map(({ value, label }) => ({
  value,
  label: String(slopeDecibels[value]),
  hint: label,
}));

const channelOptions = channels.map(({ value, label }) => ({
  value,
  label: channelBadges[value] ?? 'ST',
  hint: label,
}));

/** The selected slots, read when a control acts: the cells need not render for them. */
const selectedNow = () => getSelection().map((band) => band.slot);

/**
 * The row of cells. Each cell is memoized on the plain values it shows, so a
 * new selection renders only the cells that differ: from one bell to
 * another, the band's identity and the knobs it binds to.
 */
function Cells({ bands }: { bands: readonly Band[] }) {
  const single = bands.length === 1 ? bands[0]! : null;
  const gainApplies = bands.every((band) => hasGain(band.type));
  const qApplies = bands.every((band) => hasQ(band.type, band.slope));
  const allOn = bands.every((band) => band.enabled);
  const someOn = bands.some((band) => band.enabled);
  const slot = single?.slot ?? null;

  return (
    <ThemeProvider theme={compact}>
      <View style={ROW}>
        <Cell width={140} caption={single ? 'Band' : 'Selection'}>
          <Identity bands={bands} />
        </Cell>
        <CellDivider />
        <TypeCell type={common(bands, 'type')} />
        <CellDivider />
        <RangeCell spec={frequencySpec} width={160} caption="Frequency" slot={slot} />
        <CellDivider />
        <RangeCell
          spec={gainSpec}
          width={140}
          caption="Gain"
          slot={slot}
          unused={
            gainApplies
              ? null
              : single
                ? `Not used by ${filterTypeLabel(single.type).toLowerCase()}`
                : 'Not used by some'
          }
        />
        <CellDivider />
        <RangeCell
          spec={qSpec}
          width={130}
          caption={single ? `Q · ${qMeaning(single.type)}` : 'Q'}
          slot={slot}
          unused={qApplies ? null : single ? 'Not used at 6 dB/oct' : 'Not used by some'}
        />
        <CellDivider />
        <SlopeCell
          slope={common(bands, 'slope')}
          applies={bands.every((band) => hasSlope(band.type))}
        />
        <CellDivider />
        <ChannelCell channel={common(bands, 'channel')} />
        <CellDivider />
        <ActionsCell
          on={allOn ? true : someOn ? 'mixed' : false}
          solo={single ? single.solo : null}
          count={bands.length}
        />
      </View>
    </ThemeProvider>
  );
}

const ROW = { flex: 1, flexDirection: 'row' } as const;

const TypeCell = memo(function TypeCell({ type }: { type: FilterType | null }) {
  const theme = useTheme();
  return (
    <Cell width={150} caption="Type">
      <Select<FilterType>
        accessibilityLabel="Filter type"
        size="md"
        width={130}
        options={typeOptions}
        value={type ?? undefined}
        mixed={type === null}
        hideCheckmark
        renderValue={(option) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FilterIcon type={option.value} color={theme.color.text} />
            <Text style={textStyle(theme, 'body', theme.color.text)}>{option.label}</Text>
          </View>
        )}
        onChange={(value) => setBandsField(selectedNow(), 'type', value, 'Change filter type')}
      />
    </Cell>
  );
});

/** A range cell for one band (`slot`) or several (null), or why it does not apply. */
const RangeCell = memo(function RangeCell({
  spec,
  width,
  caption,
  slot,
  unused = null,
}: {
  spec: RangeSpec;
  width: number;
  caption: string;
  slot: number | null;
  unused?: string | null;
}) {
  return (
    <Cell width={width} caption={caption}>
      {unused !== null ? <NotUsed reason={unused} /> : <RangeControls spec={spec} slot={slot} />}
    </Cell>
  );
});

const SlopeCell = memo(function SlopeCell({
  slope,
  applies,
}: {
  slope: Slope | null;
  applies: boolean;
}) {
  return (
    <Cell width={164} caption="Slope · dB/oct">
      {applies ? (
        <SegmentedControl<Slope>
          label="Slope"
          size="sm"
          styles={compactSegments}
          options={slopeOptions}
          value={slope ?? undefined}
          mixed={slope === null}
          onChange={(value) => setBandsField(selectedNow(), 'slope', value, 'Change slope')}
        />
      ) : (
        <NotUsed reason="Cut filters only" />
      )}
    </Cell>
  );
});

const ChannelCell = memo(function ChannelCell({ channel }: { channel: Channel | null }) {
  return (
    <Cell width={164} caption="Channel">
      <SegmentedControl<Channel>
        label="Channel processing"
        size="sm"
        styles={compactSegments}
        options={channelOptions}
        value={channel ?? undefined}
        mixed={channel === null}
        onChange={(value) => setBandsField(selectedNow(), 'channel', value, 'Change channel')}
      />
    </Cell>
  );
});

const ActionsCell = memo(function ActionsCell(props: {
  on: boolean | 'mixed';
  solo: boolean | null;
  count: number;
}) {
  return (
    <Cell caption="" center>
      <Actions {...props} />
    </Cell>
  );
});
