export interface MerchantCategoryOption {
  label: string;
  slug: string;
}

export const merchantCategories: MerchantCategoryOption[] = [
  { label: 'Teknik & Arsitektur', slug: 'teknik-arsitektur' },
  { label: 'Pemrograman & IT', slug: 'pemrograman-it' },
  { label: 'Desain & Kreatif', slug: 'desain-kreatif' },
  { label: 'Bisnis & Manajemen', slug: 'bisnis-manajemen' },
];

export const merchantCategoryLabels: string[] = merchantCategories.map(
  (category) => category.label,
);

export const merchantCategorySlugs: string[] = merchantCategories.map(
  (category) => category.slug,
);

export function merchantCategorySlugForLabel(
  label: string | null | undefined,
): string | null {
  return (
    merchantCategories.find((category) => category.label === label)?.slug ??
    null
  );
}

export function merchantCategoryLabelForSlug(
  slug: string | null | undefined,
): string | null {
  return (
    merchantCategories.find((category) => category.slug === slug)?.label ?? null
  );
}
