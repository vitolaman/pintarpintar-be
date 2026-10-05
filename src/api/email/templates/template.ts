import type { EmailContent, FrontendPath } from './layout';

/** Builds a full frontend URL from one of the known paths. */
export type Link = (path: FrontendPath) => string;

export type EmailTemplate<P> = (payload: P, link: Link) => EmailContent;
