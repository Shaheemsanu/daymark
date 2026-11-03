import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from '../lib/dataService';
import { Expense } from '../types';

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from
  }
}));

const expense: Expense = {
  id: 'expense-1',
  title: 'Lunch',
  amount: 125,
  category: 'Food & Dining',
  date: '2026-11-02',
  paymentMethod: 'UPI / QR',
  type: 'expense',
  account: 'expense',
  createdAt: 0
};

const savedExpenseRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: 'user-1',
  entry_date: '2026-11-02',
  title: 'Lunch',
  amount: 125,
  category: 'Food & Dining',
  type: 'expense',
  account: 'expense',
  is_transfer: false,
  spend_type: 'need',
  payment_method: 'UPI / QR',
  notes: null,
  is_recurring: false,
  created_at: '2026-11-02T12:00:00.000Z'
};

describe('Expense persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
    supabaseMocks.insert.mockReturnThis();
    supabaseMocks.select.mockReturnThis();
    supabaseMocks.single.mockResolvedValue({ data: savedExpenseRow, error: null });
    supabaseMocks.from.mockReturnValue({
      insert: supabaseMocks.insert,
      select: supabaseMocks.select,
      single: supabaseMocks.single
    });
  });

  it('lets Supabase generate and return the new expense UUID', async () => {
    const { id: _id, createdAt: _createdAt, ...newExpense } = expense;
    const saved = await dataService.insertExpense(newExpense);

    expect(supabaseMocks.from).toHaveBeenCalledWith('expenses');
    expect(supabaseMocks.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      entry_date: '2026-11-02',
      title: 'Lunch',
      amount: 125,
      category: 'Food & Dining',
      type: 'expense',
      account: 'expense',
      is_transfer: false,
      spend_type: 'need',
      payment_method: 'UPI / QR',
      notes: null,
      is_recurring: false
    });
    expect(supabaseMocks.select).toHaveBeenCalledWith('*');
    expect(saved.id).toBe(savedExpenseRow.id);
    expect(saved.createdAt).toBe(new Date(savedExpenseRow.created_at).getTime());
  });

  it('surfaces database insert errors', async () => {
    const databaseError = new Error('new row violates row-level security policy');
    supabaseMocks.single.mockResolvedValue({ data: null, error: databaseError });

    const { id: _id, createdAt: _createdAt, ...newExpense } = expense;
    await expect(dataService.insertExpense(newExpense)).rejects.toBe(databaseError);
  });

  it('rejects invalid amounts before sending a database request', async () => {
    const { id: _id, createdAt: _createdAt, ...newExpense } = expense;
    await expect(dataService.insertExpense({ ...newExpense, amount: 0 }))
      .rejects.toThrow('Expense amount must be greater than zero.');

    expect(supabaseMocks.getUser).not.toHaveBeenCalled();
    expect(supabaseMocks.insert).not.toHaveBeenCalled();
  });
});
