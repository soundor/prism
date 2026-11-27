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

import type { Band } from '../bands/catalog';
import { deleteBands, setBandsField, setSolo } from '../bands/edit';
import { useBands } from '../bands/use-bands';

/** Band on, solo and delete, for the selected bands. */
export function Actions({ bands }: { bands: readonly Band[] }) {
  const theme = useTheme();
  const all = useBands();
  const slots = bands.map((band) => band.slot);
  const single = bands.length === 1 ? bands[0]! : null;
  const allOn = bands.every((band) => band.enabled);
  const someOn = bands.some((band) => band.enabled);
  const several = bands.length > 1;
  const deleteLabel = several ? `Delete ${bands.length} bands` : 'Delete band';

  return (
    <>
      <IconToggle
        icon={Power}
        label={several ? 'Bands on' : 'Band on'}
        tip={
          allOn
            ? 'Bypass (the band stays in place)'
            : someOn
              ? 'Mixed: press to turn all on'
              : 'Turn on'
        }
        checked={allOn ? true : someOn ? 'mixed' : false}
        color={theme.color.accent}
        onPress={() =>
          setBandsField(slots, 'enabled', !allOn, allOn ? 'Bypass band' : 'Turn band on')
        }
      />
      <IconToggle
        icon={Headphones}
        label="Solo band"
        tip={single ? 'Solo: hear this band alone' : 'Solo works on one band'}
        checked={single?.solo ?? false}
        disabled={!single}
        color={theme.color.displayWarning}
        onPress={() => single && setSolo(all, single.slot, !single.solo)}
      />
      <Tooltip content={deleteLabel}>
        <Button
          size="md"
          variant="ghost"
          accessibilityLabel={deleteLabel}
          styles={{ root: { width: 30, paddingHorizontal: 0, justifyContent: 'center' } }}
          onPress={() => deleteBands(slots)}
          leading={<Trash size={14} color={theme.color.textSecondary} strokeWidth={1.75} />}
        />
      </Tooltip>
    </>
  );
}

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
