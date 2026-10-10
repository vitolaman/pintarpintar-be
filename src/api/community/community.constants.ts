export const GROUP_ACCESS = ['public', 'request'] as const;
export type GroupAccess = (typeof GROUP_ACCESS)[number];

export type MemberRole = 'owner' | 'member';
export type MemberStatus = 'active' | 'pending';

// The caller's relation to a group, as the page shows it.
export type Membership = 'owner' | 'member' | 'pending' | 'none';

export const AUTHOR_BADGES = ['Merchant', 'Mentor', 'Siswa'] as const;
export type AuthorBadge = (typeof AUTHOR_BADGES)[number];

export const MAX_GROUP_NAME = 80;
export const MAX_GROUP_DESCRIPTION = 500;
export const MAX_THREAD_CONTENT = 5000;
export const MAX_REPLY_CONTENT = 2000;
