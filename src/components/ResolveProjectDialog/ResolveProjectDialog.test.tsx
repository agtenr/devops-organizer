import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { ResolveProjectDialog, type ResolveProjectDialogProps } from './ResolveProjectDialog';

const GUID = '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4';

function renderDialog(overrides: Partial<ResolveProjectDialogProps> = {}) {
  const props: ResolveProjectDialogProps = {
    guid: GUID,
    customer: 'Azelis',
    knownProjectNames: ['AI Sales Agents', 'Platform'],
    onResolve: vi.fn(() => Promise.resolve()),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(
    <FluentProvider theme={webLightTheme}>
      <ResolveProjectDialog {...props} />
    </FluentProvider>,
  );
  return props;
}

describe('ResolveProjectDialog', () => {
  it('shows the GUID being resolved and its organization', () => {
    renderDialog();
    expect(screen.getByText(GUID)).toBeInTheDocument();
    expect(screen.getByText('Azelis')).toBeInTheDocument();
  });

  it('dismisses via Cancel without saving', () => {
    const { onCancel, onResolve } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('disables Save until a name is entered', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the typed custom name with the GUID', () => {
    const { onResolve } = renderDialog();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'My Project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onResolve).toHaveBeenCalledWith(GUID, 'My Project');
  });

  it('offers the discovered project names as picker options', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'AI Sales Agents' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Platform' })).toBeInTheDocument();
  });
});
