import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteDialog, type ConfirmDeleteDialogProps } from './ConfirmDeleteDialog';

function renderDialog(overrides: Partial<ConfirmDeleteDialogProps> = {}) {
  const props: ConfirmDeleteDialogProps = {
    count: 1,
    subject: 'Build failed',
    onConfirm: vi.fn(() => Promise.resolve()),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(
    <FluentProvider theme={webLightTheme}>
      <ConfirmDeleteDialog {...props} />
    </FluentProvider>,
  );
  return props;
}

describe('ConfirmDeleteDialog', () => {
  it('shows the subject when deleting a single e-mail', () => {
    renderDialog({ count: 1, subject: 'Build failed' });
    expect(screen.getByText('Are you sure you want to delete "Build failed"?')).toBeInTheDocument();
  });

  it('shows the count when deleting multiple e-mails', () => {
    renderDialog({ count: 3, subject: undefined });
    expect(screen.getByText('Are you sure you want to delete 3 items?')).toBeInTheDocument();
  });

  it('dismisses via No without confirming', () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('runs the delete on Yes and closes on success', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it('shows a spinner and disables the buttons while the delete is in flight', async () => {
    let resolve: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    // In-flight: spinner (progressbar) visible and both buttons disabled.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled();

    resolve();
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it('keeps the dialog open and shows the error when the delete fails', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('Graph said no')));
    const onCancel = vi.fn();
    renderDialog({ onConfirm, onCancel });

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(await screen.findByText(/Could not delete: Graph said no/)).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
