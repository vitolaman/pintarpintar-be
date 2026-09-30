import { joinSkills, splitSkills, uniqueSkills } from './skill-list';

describe('skill list', () => {
  it('splits comma-separated text into trimmed skills', () => {
    expect(splitSkills(' AutoCAD,  SAP2000 ,,Revit ')).toEqual([
      'AutoCAD',
      'SAP2000',
      'Revit',
    ]);
  });

  it('returns an empty list for empty text', () => {
    expect(splitSkills(null)).toEqual([]);
    expect(splitSkills('')).toEqual([]);
  });

  it('joins skills in order without duplicates', () => {
    expect(joinSkills(['BIM', 'Revit', 'bim', ' '])).toBe('BIM, Revit');
  });

  it('collapses inner whitespace and keeps the first spelling', () => {
    expect(uniqueSkills(['Project  Management', 'project management'])).toEqual(
      ['Project Management'],
    );
  });
});
