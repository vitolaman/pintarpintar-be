import { ClassType } from '../../class/entities/class.entity';
import { classKindOf, classKindSql, classTypeOf } from './item-kind';

describe('item kinds', () => {
  it('maps stored class types to API kinds and back', () => {
    expect(classKindOf(ClassType.VIDEO)).toBe('kelas');
    expect(classKindOf(ClassType.LIVE_BOOTCAMP)).toBe('bootcamp');
    expect(classTypeOf('kelas')).toBe(ClassType.VIDEO);
    expect(classTypeOf('bootcamp')).toBe(ClassType.LIVE_BOOTCAMP);
  });

  it('builds the same mapping in SQL', () => {
    expect(classKindSql('class.type')).toBe(
      "(CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END)",
    );
  });
});
