import { Button, Tooltip } from '@soundor/components';
import { controlHeight, ring, useTheme } from '@soundor/components/theme';
import { Pressable } from '@soundor/react';
import {
  Headphones,
  Power,
  Trash,
  type IconComponent,
  type StrokeIconProps,
} from '@soundor/icons/lucide';

import { getSelection } from '../bands/selection';
import { deleteBands, setBandsField, setSolo } from '../bands/edit';
import { getBands } from '../bands/use-bands';

/** The selected slots, read when a button is pressed. */
const selectedNow = () => getSelection().map((band) => band.slot);

/**
 * Band on, solo and delete, for the selected bands: `on` says whether they
 * are, `solo` whether the one band is soloed (null for several), `count`
 * how many there are.
 */
export function Actions({
  on,
  solo,
  count,
}: {
  on: boolean | 'mixed';
  solo: boolean | null;
  count: number;
}) {
  const theme = useTheme();
  const single = solo !== null;
  const several = count > 1;
  const deleteLabel = several ? `Delete ${count} bands` : 'Delete band';

  return (
    <>
      <IconToggle
        icon={Power}
        label={several ? 'Bands on' : 'Band on'}
        tip={
          on === true
            ? 'Bypass (the band stays in place)'
            : on === 'mixed'
              ? 'Mixed: press to turn all on'
              : 'Turn on'
        }
        checked={on}
        color={theme.color.accent}
        onPress={() =>
          setBandsField(
            selectedNow(),
            'enabled',
            on !== true,
            on === true ? 'Bypass band' : 'Turn band on',
          )
        }
      />
      <IconToggle
        icon={Headphones}
        label="Solo band"
        tip={single ? 'Solo: hear this band alone' : 'Solo works on one band'}
        checked={solo ?? false}
        disabled={!single}
        color={theme.color.displayWarning}
        onPress={() => {
          const [slot] = selectedNow();
          if (single && slot !== undefined) setSolo(getBands(), slot, !solo);
        }}
      />
      <Tooltip content={deleteLabel}>
        <Button
          size="md"
          variant="ghost"
          accessibilityLabel={deleteLabel}
          styles={DELETE_STYLES}
          onPress={() => deleteBands(selectedNow())}
          leading={<Trash size={14} color={theme.color.textSecondary} strokeWidth={1.75} />}
        />
      </Tooltip>
    </>
  );
}

const DELETE_STYLES = {
  root: { width: 30, paddingHorizontal: 0, justifyContent: 'center' },
} as const;

/**
 * An icon button that stays pressed: graphite with the icon in `color`
 * while on. The components' Toggle shows a text label only, and a Button
 * cannot say it is pressed.
 */
function IconToggle({
  icon: Icon,
  label,
  tip,
  checked,
  disabled = false,
  color,
  onPress,
}: {
  icon: IconComponent<StrokeIconProps>;
  label: string;
  tip: string;
  checked: boolean | 'mixed';
  disabled?: boolean;
  color: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const on = checked === true;
  const foreground = disabled
    ? theme.color.textDisabled
    : on
      ? color
      : checked === 'mixed'
        ? theme.color.text
        : theme.color.textSecondary;
  return (
    <Tooltip content={tip}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="togglebutton"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ hovered, pressed, focusVisible }) => ({
          width: 30,
          height: controlHeight(theme, 'md'),
          borderRadius: theme.radius.radiusMd,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: theme.size.borderHairline,
          borderColor: on
            ? color
            : checked === 'mixed' || (hovered && !disabled)
              ? theme.color.borderStrong
              : theme.color.border,
          backgroundColor: on
            ? theme.color.selected
            : pressed && !disabled
              ? theme.color.surface
              : theme.color.surfaceElevated,
          cursor: disabled ? 'default' : 'pointer',
          ...ring(theme, focusVisible),
        })}
      >
        <Icon size={14} color={foreground} strokeWidth={1.75} />
      </Pressable>
    </Tooltip>
  );
}
