/**
 * Tells password managers that a field is not theirs (DEC-UX-211): Data Hub asks for no password, as Google signs
 * Users in, so 1Password, LastPass, Bitwarden and Dashlane offer nothing on a field where one types. Every text
 * field and text area spreads it: `<input {...NO_PASSWORD_MANAGER} …>`.
 */
export const NO_PASSWORD_MANAGER = {
  'data-1p-ignore': '',
  'data-lpignore': 'true',
  'data-bwignore': '',
  'data-form-type': 'other',
} as const;
