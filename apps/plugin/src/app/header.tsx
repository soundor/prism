import { Button, DropdownMenu, Menu, SegmentedControl, Toggle, Tooltip } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Redo2,
  Undo2,
  type IconComponent,
  type StrokeIconProps,
} from '@soundor/icons/lucide';
import { Image, Text, useHistory, useParameter, useStateValue, View } from '@soundor/react';
import { parameters } from 'soundor:parameters';
import { presets } from 'soundor:presets';
import { state, type CompareSide } from 'soundor:state';

import logo from '../../../../assets/brand/svg/soundor-prism-logo.svg';
import { copyCompare, otherSide, switchCompare } from '../presets/compare';
import { loadFactoryPreset, useFactorySelection } from '../presets/factory';
import { HEADER_HEIGHT } from './layout';

const PRESET_WIDTH = 236;
const LOGO_GAP = 64;

export function Header() {
  const theme = useTheme();
  const bypassed = useParameter(parameters.bypass);
  const history = useHistory();
  const side = useStateValue(state.compareSide);
  const from = side.toUpperCase();
  const to = otherSide(side).toUpperCase();
  // Equal side lanes keep the A/B switch centered independently of their contents.
  const lane = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.spaceSm,
  } as const;
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Prism"
      style={{
        height: HEADER_HEIGHT,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.spaceSm,
        paddingHorizontal: 14,
        borderBottomWidth: theme.size.borderHairline,
        borderColor: theme.color.divider,
      }}
    >
      <View style={lane}>
        <Image
          source={logo}
          accessibilityLabel="Soundor Prism"
          style={{ width: 78, height: 30, resizeMode: 'contain', marginRight: LOGO_GAP }}
        />
        <PresetControls />
        <Separator />
        <IconButton
          icon={Undo2}
          label="Undo"
          tip={history.undoLabel ? `Undo: ${history.undoLabel}` : 'Undo'}
          disabled={!history.canUndo}
          onPress={history.undo}
        />
        <IconButton
          icon={Redo2}
          label="Redo"
          tip={history.redoLabel ? `Redo: ${history.redoLabel}` : 'Redo'}
          disabled={!history.canRedo}
          onPress={history.redo}
        />
        <Separator />
      </View>
      <SegmentedControl<CompareSide>
        size="sm"
        label="Compare A/B"
        styles={{
          root: { alignSelf: 'center', padding: 2, borderRadius: theme.radius.radiusMd },
          segment: { height: 18, minWidth: 28, paddingHorizontal: 0 },
          label: { fontSize: 10, lineHeight: 14 },
        }}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value={side}
        onChange={switchCompare}
      />
      <View style={[lane, { justifyContent: 'space-between' }]}>
        <Button
          size="sm"
          accessibilityLabel={`Copy ${from} to ${to}`}
          leading={<Copy size={12} color={theme.color.textSecondary} strokeWidth={1.75} />}
          onPress={copyCompare}
        >
          {`${from} → ${to}`}
        </Button>
        <Toggle
          parameter={parameters.bypass}
          label="Bypass"
          accessibilityLabel="Global bypass"
          size="sm"
          styles={{
            root: {
              alignSelf: 'center',
              ...(bypassed && {
                backgroundColor: theme.color.selected,
                borderColor: theme.color.warning,
              }),
            },
            label: bypassed ? { color: theme.color.displayWarning } : undefined,
            indicator: bypassed ? { backgroundColor: theme.color.displayWarning } : undefined,
          }}
        />
      </View>
    </View>
  );
}

function PresetControls() {
  const theme = useTheme();
  const { factoryId, modified } = useFactorySelection();
  const catalog = presets.factory.list();
  const index = catalog.findIndex((preset) => preset.id === factoryId);
  const name = catalog[index]?.name ?? 'Custom';
  const step = (delta: -1 | 1) => {
    const i =
      index < 0
        ? delta === 1
          ? 0
          : catalog.length - 1
        : (index + delta + catalog.length) % catalog.length;
    const preset = catalog[i];
    if (preset) loadFactoryPreset(preset);
  };
  return (
    <>
      <IconButton icon={ChevronLeft} label="Previous preset" onPress={() => step(-1)} />
      <DropdownMenu>
        <DropdownMenu.Trigger>
          <Button
            size="sm"
            accessibilityLabel={`Preset menu: ${name}${modified ? ', modified' : ''}`}
            styles={{ root: { width: PRESET_WIDTH, paddingHorizontal: 0 } }}
          >
            <View
              style={{
                width: PRESET_WIDTH - 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.spaceSm,
              }}
            >
              <Text style={textStyle(theme, 'technical', theme.color.textMuted)}>
                {index < 0 ? '—' : String(index + 1).padStart(2, '0')}
              </Text>
              <Text
                numberOfLines={1}
                style={[textStyle(theme, 'button'), { flex: 1, fontSize: 11 }]}
              >
                {name}
              </Text>
              {modified && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.color.accentStrong,
                  }}
                />
              )}
              <ChevronDown size={12} color={theme.color.textSecondary} strokeWidth={1.75} />
            </View>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          size="sm"
          accessibilityLabel="Factory presets"
          styles={{ root: { minWidth: PRESET_WIDTH } }}
        >
          <Menu.Label>Factory</Menu.Label>
          {catalog.map((preset) => (
            <Menu.Item
              key={preset.id}
              checked={preset.id === factoryId}
              onPress={() => loadFactoryPreset(preset)}
            >
              {preset.name}
            </Menu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
      <IconButton icon={ChevronRight} label="Next preset" onPress={() => step(1)} />
    </>
  );
}

function Separator() {
  const theme = useTheme();
  return (
    <View
      style={{ width: theme.size.borderHairline, height: 18, backgroundColor: theme.color.divider }}
    />
  );
}

function IconButton({
  icon: Icon,
  label,
  tip = label,
  disabled,
  onPress,
}: {
  icon: IconComponent<StrokeIconProps>;
  label: string;
  tip?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Tooltip content={tip}>
      <Button
        size="sm"
        variant="ghost"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        leading={<Icon size={14} color={theme.color.textSecondary} strokeWidth={1.75} />}
        styles={{ root: { width: 24, paddingHorizontal: 0 } }}
      />
    </Tooltip>
  );
}
