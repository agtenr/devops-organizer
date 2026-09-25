import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import type { SavedView } from '../../models/savedViews';
import { SavedViews, type SavedViewsProps } from './SavedViews';

const VIEW_A: SavedView = {
  id: 'view-a',
  name: 'Contoso failed builds',
  customer: 'Contoso',
  project: 'Alpha',
  typeKeys: ['Build::Failed'],
  searchQuery: '',
  isDefault: true,
};
const VIEW_B: SavedView = {
  id: 'view-b',
  name: 'Adatum reviews',
  customer: 'Adatum',
  project: null,
  typeKeys: [],
  searchQuery: '',
  isDefault: false,
};

function renderPanel(overrides: Partial<SavedViewsProps> = {}) {
  const props: SavedViewsProps = {
    savedViews: [VIEW_A, VIEW_B],
    onApply: vi.fn(),
    onSaveCurrent: vi.fn(() => Promise.resolve()),
    onRename: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(() => Promise.resolve()),
    onSetDefault: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  render(
    <FluentProvider theme={webLightTheme}>
      <SavedViews {...props} />
    </FluentProvider>,
  );
  return props;
}

describe('SavedViews', () => {
  it('shows the empty message when there are no saved views', () => {
    renderPanel({ savedViews: [] });
    expect(screen.getByText('No saved views yet.')).toBeInTheDocument();
  });

  it('renders one row per saved view', () => {
    renderPanel();
    expect(screen.getByRole('listitem', { name: /Contoso failed builds/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Adatum reviews/ })).toBeInTheDocument();
  });

  it('clicking a view name applies it', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Contoso failed builds' }));
    expect(props.onApply).toHaveBeenCalledWith('view-a');
  });

  it('clicking the star marks the view as default', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Adatum reviews as default' }));
    expect(props.onSetDefault).toHaveBeenCalledWith('view-b');
  });

  it('clicking delete calls onDelete with no confirm dialog rendered', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Adatum reviews' }));

    expect(props.onDelete).toHaveBeenCalledWith('view-b');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Save current view" opens the dialog and saving calls onSaveCurrent with the entered name', async () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Save current view' }));
    expect(screen.getByRole('heading', { name: 'Save current view' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'New view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(props.onSaveCurrent).toHaveBeenCalledWith('New view'));
  });

  it('the rename icon opens the dialog prefilled and calls onRename for that view', async () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Rename Contoso failed builds' }));
    expect(screen.getByRole('heading', { name: 'Rename view' })).toBeInTheDocument();
    expect(screen.getByLabelText('View name')).toHaveValue('Contoso failed builds');

    fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(props.onRename).toHaveBeenCalledWith('view-a', 'Renamed'));
  });
});
