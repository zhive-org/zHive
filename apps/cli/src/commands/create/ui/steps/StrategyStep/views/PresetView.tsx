import React, { useCallback } from 'react';
import { SelectPrompt } from '../../../../../../components/SelectPrompt';
import { STRATEGY_PRESETS } from '../../../../presets/data';
import type { PresetViewProps } from '../useStrategyController';

const CUSTOM_VALUE = '__custom__';

const items = [
  ...STRATEGY_PRESETS.map((p) => ({
    label: p.name,
    value: p.name,
    description: p.philosophy,
  })),
  {
    label: 'Custom',
    value: CUSTOM_VALUE,
    description: 'Let an agent interview you to design the strategy.',
  },
];

export function PresetView({
  defaultValue,
  onPick,
  onPickCustom,
  onWizardBack,
}: PresetViewProps): React.ReactElement {
  const handleSelect = useCallback(
    (item: { value: string }) => {
      if (item.value === CUSTOM_VALUE) onPickCustom();
      else onPick(item.value);
    },
    [onPick, onPickCustom],
  );

  return (
    <SelectPrompt
      label="Choose a strategy preset or chat with the agent"
      items={items}
      defaultValue={defaultValue}
      onSelect={handleSelect}
      onBack={onWizardBack}
    />
  );
}
