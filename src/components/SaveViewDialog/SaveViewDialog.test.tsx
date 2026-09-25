import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { SaveViewDialog, type SaveViewDialogProps } from './SaveViewDialog';

function renderDialog(overrides: Partial<SaveViewDialogProps> = {}) {
  const props = {
    title: 'Save current view',
    initialName: '',
    onSave: vi.fn(() => Promise.resolve()),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(
    <FluentProvider theme={webLightTheme}>
      <SaveViewDialog {...props} />
    </FluentProvider>,
  );
  return props;
}

describe('SaveViewDialog', () => {
  it('renders the given title and initial name', () => {
    renderDialog({ title: 'Rename view', initialName: 'My view' });

    expect(screen.getByRole('heading', { name: 'Rename view' })).toBeInTheDocument();
    expect(screen.getByLabelText('View name')).toHaveValue('My view');
  });

  it('disables Save until a name is entered', () => {
    renderDialog({ initialName: '' });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'New view' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('calls onSave with the entered name, then onCancel on success', async () => {
    const props = renderDialog();

    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'New view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(props.onCancel).toHaveBeenCalledTimes(1));
    expect(props.onSave).toHaveBeenCalledWith('New view');
  });

  it('Cancel dismisses without saving', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('shows the error and stays open on a failed save', async () => {
    const props = renderDialog({ onSave: vi.fn(() => Promise.reject(new Error('Graph 500'))) });

    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'New view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Could not save the view: Graph 500/)).toBeInTheDocument();
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
