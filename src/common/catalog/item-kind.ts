import { ClassType } from '../../class/entities/class.entity';

// The API names item kinds `kelas`, `bootcamp`, `digital` and `bundle`
// everywhere. Classes store their kind as `video` or `live-bootcamp`; these
// helpers are the only place the two vocabularies meet.
export const itemKinds = ['kelas', 'bootcamp', 'digital', 'bundle'] as const;
export type ItemKind = (typeof itemKinds)[number];

export const classKinds = ['kelas', 'bootcamp'] as const;
export type ClassKind = (typeof classKinds)[number];

const KIND_OF_CLASS_TYPE: Record<ClassType, ClassKind> = {
  [ClassType.VIDEO]: 'kelas',
  [ClassType.LIVE_BOOTCAMP]: 'bootcamp',
};

const CLASS_TYPE_OF_KIND: Record<ClassKind, ClassType> = {
  kelas: ClassType.VIDEO,
  bootcamp: ClassType.LIVE_BOOTCAMP,
};

export function classKindOf(type: ClassType | string): ClassKind {
  return KIND_OF_CLASS_TYPE[type as ClassType] ?? 'kelas';
}

export function classTypeOf(kind: ClassKind): ClassType {
  return CLASS_TYPE_OF_KIND[kind];
}

/** SQL expression mapping a stored class type column to its API kind. */
export function classKindSql(column: string): string {
  return `(CASE WHEN ${column} = '${ClassType.LIVE_BOOTCAMP}' THEN 'bootcamp' ELSE 'kelas' END)`;
}
