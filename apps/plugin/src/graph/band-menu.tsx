import { ContextMenu, Menu } from '@soundor/components';

import { filterTypeLabel, filterTypes, hasGain, type Band } from '../bands/catalog';
import { duplicateBand, freeSlot, setBandsField, setSolo } from '../bands/edit';
import { FilterIcon } from '../bands/filter-icon';

/** Actions for the marker that opened the menu. Delete follows the marker's keyboard behavior. */
export function BandMenu({
  band,
  bands,
  removeLabel,
  onRemove,
}: {
  band: Band;
  bands: readonly Band[];
  removeLabel: string;
  onRemove: () => void;
}) {
  const slots = [band.slot];
  const bypassLabel = band.enabled ? 'Bypass band' : 'Enable band';
  return (
    <ContextMenu.Content accessibilityLabel={`Band ${band.slot} actions`} size="sm">
      <Menu.Label>{`Band ${band.slot} · ${filterTypeLabel(band.type)}`}</Menu.Label>
      <Menu.Item onPress={() => setBandsField(slots, 'enabled', !band.enabled, bypassLabel)}>
        {bypassLabel}
      </Menu.Item>
      <Menu.Item onPress={() => setSolo(bands, band.slot, !band.solo)}>
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
      <Menu.Item disabled={freeSlot(bands) === null} onPress={() => duplicateBand(bands, band)}>
        Duplicate
      </Menu.Item>
      <Menu.Item onPress={onRemove}>{removeLabel}</Menu.Item>
    </ContextMenu.Content>
  );
}
