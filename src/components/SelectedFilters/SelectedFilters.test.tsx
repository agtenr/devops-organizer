import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { SelectedFilters } from './SelectedFilters';
import type { SelectedFilterChip } from './filterChips';

const PROJECT_CHIP: SelectedFilterChip = {
  key: 'project',
  facet: 'project',
  value: 'Alpha',
  label: 'Project: Alpha',
};
const TYPE_CHIP: SelectedFilterChip = {
  key: 'Build::Failed',
  facet: 'type',
  value: 'Build::Failed',
  label: 'Type: Build · Failed',
};

function renderChips(filters: SelectedFilterChip[], onRemove = vi.fn()) {
  render(
    <FluentProvider theme={webLightTheme}>
      <SelectedFilters filters={filters} onRemove={onRemove} />
    </FluentProvider>,
  );
  return onRemove;
}

describe('SelectedFilters', () => {
  it('renders nothing when no filter is selected', () => {
    const { container } = render(
      <FluentProvider theme={webLightTheme}>
        <SelectedFilters filters={[]} onRemove={vi.fn()} />
      </FluentProvider>,
    );
    // No chips and no group; the toolbar is visually unchanged.
    expect(container.querySelector('[aria-label="Active filters"]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders one labelled chip per active filter', () => {
    renderChips([PROJECT_CHIP, TYPE_CHIP]);
    expect(screen.getByRole('button', { name: 'Project: Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type: Build · Failed' })).toBeInTheDocument();
  });

  it('calls onRemove with the matching chip when its dismiss (X) is clicked', () => {
    const onRemove = renderChips([PROJECT_CHIP, TYPE_CHIP]);
    // A dismissible Tag's root is the dismiss button; clicking it fires onDismiss for that value.
    fireEvent.click(screen.getByRole('button', { name: 'Type: Build · Failed' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(TYPE_CHIP);
  });
});
