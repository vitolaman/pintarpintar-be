import { PermissionMatrix } from '../class-permissions';

// Typical tutor matrices for tests: a lead with every permission, an
// assistant who grades, and a moderator who runs meetings. They are not the
// defaults, which are view-only for every role.
const ALL = { lihat: true, tambah: true, edit: true, delete: true };
const NONE = { lihat: false, tambah: false, edit: false, delete: false };
const VIEW = { ...NONE, lihat: true };

export const TUTOR_PERMISSION_FIXTURES: Record<
  'lead' | 'assistant' | 'moderator',
  PermissionMatrix
> = {
  lead: { materi: ALL, meeting: ALL, tugas: ALL, nilai: ALL, sertifikat: ALL },
  assistant: {
    materi: VIEW,
    meeting: NONE,
    tugas: VIEW,
    nilai: ALL,
    sertifikat: NONE,
  },
  moderator: {
    materi: VIEW,
    meeting: ALL,
    tugas: NONE,
    nilai: NONE,
    sertifikat: NONE,
  },
};
