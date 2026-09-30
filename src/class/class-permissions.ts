import { BadRequestException } from '@nestjs/common';

// Tutor roles and the class permission matrix used by the class editor
// (areas × actions). The owner of the class's merchant always has full access.
export const TUTOR_ROLES = ['lead', 'assistant', 'moderator'] as const;
export type TutorRole = (typeof TUTOR_ROLES)[number];

export const CLASS_AREAS = [
  'materi',
  'meeting',
  'tugas',
  'nilai',
  'sertifikat',
] as const;
export type ClassArea = (typeof CLASS_AREAS)[number];

export const CLASS_ACTIONS = ['lihat', 'tambah', 'edit', 'delete'] as const;
export type ClassAction = (typeof CLASS_ACTIONS)[number];

export type PermissionMatrix = Record<ClassArea, Record<ClassAction, boolean>>;

// Frontend role labels that existing assignments may still carry.
export const TUTOR_ROLE_LABELS: Record<string, TutorRole> = {
  'Lead Tutor / Instruktur Utama': 'lead',
  'Asisten Tutor (Grading & Q&A)': 'assistant',
  'Moderator Live Session': 'moderator',
};

function matrix(
  grants: Partial<Record<ClassArea, ClassAction[]>>,
): PermissionMatrix {
  return Object.fromEntries(
    CLASS_AREAS.map((area) => [
      area,
      Object.fromEntries(
        CLASS_ACTIONS.map((action) => [
          action,
          grants[area]?.includes(action) ?? false,
        ]),
      ),
    ]),
  ) as PermissionMatrix;
}

const ALL_ACTIONS = [...CLASS_ACTIONS];

export const DEFAULT_TUTOR_PERMISSIONS: Record<TutorRole, PermissionMatrix> = {
  lead: matrix(
    Object.fromEntries(CLASS_AREAS.map((area) => [area, ALL_ACTIONS])),
  ),
  assistant: matrix({
    materi: ['lihat'],
    tugas: ['lihat'],
    nilai: ALL_ACTIONS,
  }),
  moderator: matrix({ materi: ['lihat'], meeting: ALL_ACTIONS }),
};

// Validates a client-supplied matrix; areas or actions left out are false.
export function parsePermissionMatrix(input: unknown): PermissionMatrix {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('permissions must be an object');
  }
  const parsed = matrix({});
  for (const [area, actions] of Object.entries(input)) {
    if (!(CLASS_AREAS as readonly string[]).includes(area)) {
      throw new BadRequestException(`Unknown permission area: ${area}`);
    }
    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
      throw new BadRequestException(`permissions.${area} must be an object`);
    }
    for (const [action, granted] of Object.entries(actions)) {
      if (!(CLASS_ACTIONS as readonly string[]).includes(action)) {
        throw new BadRequestException(
          `Unknown permission action: ${area}.${action}`,
        );
      }
      if (typeof granted !== 'boolean') {
        throw new BadRequestException(
          `permissions.${area}.${action} must be true or false`,
        );
      }
      parsed[area as ClassArea][action as ClassAction] = granted;
    }
  }
  return parsed;
}
