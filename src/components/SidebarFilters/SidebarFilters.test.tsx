import { fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { SidebarFilters } from './SidebarFilters';
import type { FilterOption } from './facetFilters';

// Fluent UI v9 components read theme/context from FluentProvider, so mount through the same wrapper
// the app uses (see `.claude/rules/testing.md`).
function renderSidebar(props: Parameters<typeof SidebarFilters>[0]) {
  return render(
    <FluentProvider theme={webLightTheme}>
      <SidebarFilters {...props} />
    </FluentProvider>,
  );
}

const projectOptions: FilterOption[] = [
  { value: 'Alpha', label: 'Alpha', count: 2 },
  { value: 'Beta', label: 'Beta', count: 1 },
];
const typeOptions: FilterOption[] = [
  { value: 'Build::Failed', label: 'Build · Failed', count: 3 },
  { value: 'Work item::Assigned', label: 'Work item · Assigned', count: 1 },
];

function baseProps(overrides: Partial<Parameters<typeof SidebarFilters>[0]> = {}) {
  return {
    projectOptions,
    selectedProject: null,
    onSelectProject: vi.fn(),
    typeOptions,
    selectedTypeKeys: new Set<string>(),
    onToggleType: vi.fn(),
    ...overrides,
  };
}

describe('SidebarFilters', () => {
  it('renders a row per project and type option with its counter', () => {
    renderSidebar(baseProps());

    const alpha = screen.getByRole('button', { name: /Alpha/ });
    expect(within(alpha).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beta/ })).toBeInTheDocument();

    const buildFailed = screen.getByRole('button', { name: /Build · Failed/ });
    expect(within(buildFailed).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Work item · Assigned/ })).toBeInTheDocument();
  });

  it('marks the selected project and selected types as pressed', () => {
    renderSidebar(
      baseProps({
        selectedProject: 'Alpha',
        selectedTypeKeys: new Set(['Build::Failed']),
      }),
    );

    expect(screen.getByRole('button', { name: /Alpha/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Beta/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Build · Failed/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Work item · Assigned/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('fires onSelectProject / onToggleType with the clicked option value', () => {
    const onSelectProject = vi.fn();
    const onToggleType = vi.fn();
    renderSidebar(baseProps({ onSelectProject, onToggleType }));

    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onSelectProject).toHaveBeenCalledWith('Beta');

    fireEvent.click(screen.getByRole('button', { name: /Work item · Assigned/ }));
    expect(onToggleType).toHaveBeenCalledWith('Work item::Assigned');
  });

  it('shows a "None" placeholder for an empty facet group', () => {
    renderSidebar(baseProps({ projectOptions: [] }));
    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
