import { isTradingHours } from '../time';

describe('isTradingHours', () => {
  it('returns false on weekends', () => {
    // 2026-06-13 is a Saturday
    expect(isTradingHours(new Date('2026-06-13T10:00:00'))).toBe(false);
  });

  it('returns false before market open (before 9:15)', () => {
    expect(isTradingHours(new Date('2026-06-12T09:00:00'))).toBe(false);
  });

  it('returns true during morning session (9:15-11:30)', () => {
    expect(isTradingHours(new Date('2026-06-12T10:00:00'))).toBe(true);
  });

  it('returns false during lunch break (11:30-13:00)', () => {
    expect(isTradingHours(new Date('2026-06-12T12:00:00'))).toBe(false);
  });

  it('returns true during afternoon session (13:00-15:00)', () => {
    expect(isTradingHours(new Date('2026-06-12T14:00:00'))).toBe(true);
  });

  it('returns false after market close (after 15:00)', () => {
    expect(isTradingHours(new Date('2026-06-12T16:00:00'))).toBe(false);
  });
});