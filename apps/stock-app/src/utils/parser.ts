/**
 * 从 AI 分析摘要文本中解析风险项和利好催化项
 */
export function parseRiskAndCatalyst(summaryText: string | undefined | null): {
  riskItems: string[];
  catalystItems: string[];
} {
  const riskItems: string[] = [];
  const catalystItems: string[] = [];
  if (!summaryText) return { riskItems, catalystItems };

  const lines = summaryText.split('\n');
  let inRisk = false, inCatalyst = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // 优先匹配 bullet 条目，避免条目内容误匹配 section 关键词
    if (/^[-•▪*]\s*/.test(trimmed)) {
      if (inRisk) riskItems.push(trimmed.replace(/^[-•▪*]\s*/, ''));
      if (inCatalyst) catalystItems.push(trimmed.replace(/^[-•▪*]\s*/, ''));
    } else if (/风险|⚠️|危险|风险提示|风险因素|注意|谨慎/.test(trimmed)) {
      inRisk = true; inCatalyst = false;
    } else if (/利好|催化|✅|积极因素|正面|机会/.test(trimmed)) {
      inRisk = false; inCatalyst = true;
    } else if (/结论|策略|操作|建议|总结|展望/.test(trimmed)) {
      inRisk = false; inCatalyst = false;
    }
  }
  return { riskItems, catalystItems };
}