import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { QuickLogModal } from '../components/QuickLogModal';
import { Expense } from '../types';

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderQuickLog = (
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>,
  onClose = vi.fn()
) => {
  render(
    <QuickLogModal
      isOpen
      onClose={onClose}
      onAddExpense={onAddExpense}
      onAddTask={vi.fn()}
      availableExpenseCategories={['Groceries']}
      habits={[]}
      onToggleHabit={vi.fn()}
      selectedDate="2026-11-02"
      currencySymbol="₹"
    />
  );
  return onClose;
};

describe('Quick expense logging', () => {
  it('shows a loading state until Supabase confirms the insert', async () => {
    const insert = createDeferred<void>();
    const onAddExpense = vi.fn(() => insert.promise);
    const onClose = renderQuickLog(onAddExpense);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Transaction/ }));

    expect(await screen.findByText('Saving...')).toBeInTheDocument();
    expect(onAddExpense).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    insert.resolve();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps the form open and displays the Supabase error when saving fails', async () => {
    const insert = createDeferred<void>();
    const onAddExpense = vi.fn(() => insert.promise);
    const onClose = renderQuickLog(onAddExpense);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Transaction/ }));
    insert.reject(new Error('new row violates row-level security policy'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'new row violates row-level security policy'
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
