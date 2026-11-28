import { ContextMenu, Menu } from '@soundor/components';

import { filterTypeLabel, filterTypes, hasGain, MAX_BANDS, type Band } from '../bands/catalog';
import { duplicateBand, setBandsField, setSolo } from '../bands/edit';
import { FilterIcon } from '../bands/filter-icon';
import { bandsSource, getBands } from '../bands/use-bands';
import { useSelector } from '../utils/store';

const isFull = (bands: readonly Band[]) => bands.length >= MAX_BANDS;

interface BandMenuProps {
  band: Band;
  removeLabel: string;
  onRemove: () => void;
}

/**
 * Actions for the marker that opened the menu. Delete follows the marker's
 * keyboard behavior. The items are a component of their own, which the menu
 * renders only while it is open: closed, each marker's menu costs nothing.
 */
export function BandMenu(props: BandMenuProps) {
  return (
    <ContextMenu.Content accessibilityLabel={`Band ${props.band.slot} actions`} size="sm">
      <BandMenuItems {...props} />
    </ContextMenu.Content>
  );
}

function BandMenuItems({ band, removeLabel, onRemove }: BandMenuProps) {
  const full = useSelector(bandsSource, isFull);
  const slots = [band.slot];
  const bypassLabel = band.enabled ? 'Bypass band' : 'Enable band';
  return (
    <>
      <Menu.Label>{`Band ${band.slot} · ${filterTypeLabel(band.type)}`}</Menu.Label>
      <Menu.Item onPress={() => setBandsField(slots, 'enabled', !band.enabled, bypassLabel)}>
        {bypassLabel}
      </Menu.Item>
      <Menu.Item onPress={() => setSolo(getBands(), band.slot, !band.solo)}>
        {band.solo ? 'Stop solo' : 'Solo band'}
      </Menu.Item>
      <Menu.Item
        disabled={!hasGain(band.type) || band.gain === 0}
        onPress={() => setBandsField(slots, 'gain', 0, 'Reset gain')}
      >
        Reset gain
      </Menu.Item>
      <Menu.Sub>
        <Menu.SubTrigger>Filter type</Menu.SubTrigger>
        <Menu.SubContent>
          {filterTypes.map(({ value, label }) => (
            <Menu.Item
              key={value}
              checked={value === band.type}
              highlightChecked
              hideCheckmark
              renderIcon={({ color }) => <FilterIcon type={value} color={color} />}
              onPress={() => setBandsField(slots, 'type', value, 'Change filter type')}
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.SubContent>
      </Menu.Sub>
      <Menu.Divider />
      <Menu.Item disabled={full} onPress={() => duplicateBand(getBands(), band)}>
        Duplicate
      </Menu.Item>
      <Menu.Item onPress={onRemove}>{removeLabel}</Menu.Item>
    </>
  );
}
