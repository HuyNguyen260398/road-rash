// Initial-based avatar label: the uppercase first character of the user's email
// (no Google profile photo). Falls back to "?" when there is no email.
export function avatarInitial(email?: string | null): string {
  const trimmed = email?.trim() ?? "";
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
