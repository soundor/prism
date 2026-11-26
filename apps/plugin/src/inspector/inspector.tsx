import { SegmentedControl, Select, type SelectOption } from '@soundor/components';
import { textStyle, ThemeProvider, useTheme } from '@soundor/components/theme';
import { MousePointer2 } from '@soundor/icons/lucide';
import { Text, View } from '@soundor/react';

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
import { useSelection } from '../bands/selection';
import { useBands } from '../bands/use-bands';
import { Actions } from './actions';
import { BandStrip } from './band-strip';
import { Cell, CellDivider, CONTROL_HEIGHT, NotUsed } from './cells';
import { Identity } from './identity';
import { RangeControls } from './range-cell';
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
export function Inspector() {
  const theme = useTheme();
  const selection = useSelection();
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

function NothingSelected() {
  const theme = useTheme();
  const empty = useBands().length === 0;
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

function Cells({ bands }: { bands: readonly Band[] }) {
  const theme = useTheme();
  const single = bands.length === 1 ? bands[0]! : null;
  const slots = bands.map((band) => band.slot);
  const type = common(bands, 'type');
  const slope = common(bands, 'slope');
  const channel = common(bands, 'channel');
  const gainApplies = bands.every((band) => hasGain(band.type));
  const qApplies = bands.every((band) => hasQ(band.type, band.slope));
  const slopeApplies = bands.every((band) => hasSlope(band.type));

  return (
    <ThemeProvider theme={compact}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Cell width={140} caption={single ? 'Band' : 'Selection'}>
          <Identity bands={bands} />
        </Cell>
        <CellDivider />

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
            onChange={(value) => setBandsField(slots, 'type', value, 'Change filter type')}
          />
        </Cell>
        <CellDivider />

        <Cell width={160} caption="Frequency">
          <RangeControls spec={frequencySpec} bands={bands} />
        </Cell>
        <CellDivider />

        <Cell width={140} caption="Gain">
          {gainApplies ? (
            <RangeControls spec={gainSpec} bands={bands} />
          ) : (
            <NotUsed
              reason={
                single
                  ? `Not used by ${filterTypeLabel(single.type).toLowerCase()}`
                  : 'Not used by some'
              }
            />
          )}
        </Cell>
        <CellDivider />

        <Cell width={130} caption={single ? `Q · ${qMeaning(single.type)}` : 'Q'}>
          {qApplies ? (
            <RangeControls spec={qSpec} bands={bands} />
          ) : (
            <NotUsed reason={single ? 'Not used at 6 dB/oct' : 'Not used by some'} />
          )}
        </Cell>
        <CellDivider />

        <Cell width={164} caption="Slope · dB/oct">
          {slopeApplies ? (
            <SegmentedControl<Slope>
              label="Slope"
              size="sm"
              styles={compactSegments}
              options={slopeOptions}
              value={slope ?? undefined}
              mixed={slope === null}
              onChange={(value) => setBandsField(slots, 'slope', value, 'Change slope')}
            />
          ) : (
            <NotUsed reason="Cut filters only" />
          )}
        </Cell>
        <CellDivider />

        <Cell width={164} caption="Channel">
          <SegmentedControl<Channel>
            label="Channel processing"
            size="sm"
            styles={compactSegments}
            options={channelOptions}
            value={channel ?? undefined}
            mixed={channel === null}
            onChange={(value) => setBandsField(slots, 'channel', value, 'Change channel')}
          />
        </Cell>
        <CellDivider />

        <Cell caption="" center>
          <Actions bands={bands} />
        </Cell>
      </View>
    </ThemeProvider>
  );
}
