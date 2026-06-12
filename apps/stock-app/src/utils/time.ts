/**
 * 判断当前是否为 A 股交易时间
 * 交易日 9:15-11:30, 13:00-15:00
 */
export function isTradingHours(now?: Date): boolean {
  const d = now ?? new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  const total = h * 60 + m;
  const open = 9 * 60 + 15;
  const closeMorning = 11 * 60 + 30;
  const openAfternoon = 13 * 60;
  const close = 15 * 60;
  const weekDay = d.getDay();
  if (weekDay === 0 || weekDay === 6) return false;
  if (total < open || total > close) return false;
  if (total > closeMorning && total < openAfternoon) return false;
  return true;
}