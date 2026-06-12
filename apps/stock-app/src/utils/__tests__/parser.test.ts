import { parseRiskAndCatalyst } from '../parser';

describe('parseRiskAndCatalyst', () => {
  it('returns empty arrays for null/undefined input', () => {
    const result = parseRiskAndCatalyst(null);
    expect(result.riskItems).toEqual([]);
    expect(result.catalystItems).toEqual([]);
  });

  it('returns empty arrays for empty string', () => {
    const result = parseRiskAndCatalyst('');
    expect(result.riskItems).toEqual([]);
    expect(result.catalystItems).toEqual([]);
  });

  it('parses risk items correctly', () => {
    const text = [
      '## 风险提示',
      '- 市场竞争加剧',
      '- 政策不确定性',
    ].join('\n');
    const result = parseRiskAndCatalyst(text);
    expect(result.riskItems).toEqual(['市场竞争加剧', '政策不确定性']);
    expect(result.catalystItems).toEqual([]);
  });

  it('parses catalyst items correctly', () => {
    const text = [
      '## 利好催化',
      '- 新产品发布',
      '- 业绩超预期',
    ].join('\n');
    const result = parseRiskAndCatalyst(text);
    expect(result.catalystItems).toEqual(['新产品发布', '业绩超预期']);
    expect(result.riskItems).toEqual([]);
  });

  it('parses both risk and catalyst items', () => {
    const text = [
      '⚠️ 风险',
      '- 行业下行周期',
      '',
      '✅ 积极因素',
      '- 技术壁垒高',
    ].join('\n');
    const result = parseRiskAndCatalyst(text);
    expect(result.riskItems).toEqual(['行业下行周期']);
    expect(result.catalystItems).toEqual(['技术壁垒高']);
  });

  it('stops parsing when conclusion section is reached', () => {
    const text = [
      '⚠️ 风险',
      '- 风险项1',
      '## 结论',
      '- 这不是风险',
    ].join('\n');
    const result = parseRiskAndCatalyst(text);
    expect(result.riskItems).toEqual(['风险项1']);
  });
});