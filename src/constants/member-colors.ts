/** Existing stored values and their human-readable names; order is part of onboarding defaults. */
export const MemberColorOptions = [
  { value: '#C8385A', label: 'Rose framboise' },
  { value: '#2F5D9E', label: 'Bleu' },
  { value: '#1F7A55', label: 'Vert' },
  { value: '#C26A1B', label: 'Orange' },
  { value: '#6D4AB0', label: 'Violet' },
  { value: '#B03C8C', label: 'Rose mauve' },
  { value: '#1D7C86', label: 'Bleu canard' },
] as const;

export const MemberColors: string[] = MemberColorOptions.map(option => option.value);
