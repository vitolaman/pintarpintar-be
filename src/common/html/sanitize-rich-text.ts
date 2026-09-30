import * as sanitizeHtml from 'sanitize-html';

export const RICH_TEXT_MAX_LENGTH = 10000;

const FONT_SIZE = /^(1[0-9]|2[0-9]|3[0-2])px$/;
const TEXT_ALIGN = /^(left|center|right|justify)$/;

// Mirrors the merchant description editor: bold, italic, underline,
// alignment and font sizes 10–32px. Everything else, including links,
// scripts, event handlers and other styles, is removed.
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'div',
    'span',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'ul',
    'ol',
    'li',
  ],
  allowedAttributes: { p: ['style'], div: ['style'], span: ['style'] },
  allowedStyles: {
    '*': { 'font-size': [FONT_SIZE], 'text-align': [TEXT_ALIGN] },
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS).trim();
}
