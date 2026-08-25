export function validateBusinessCode(code: string | undefined | null): string {
  if (!code) throw new Error('Business ID is required.');
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 3 || trimmed.length > 50) {
    throw new Error('Business ID must be between 3 and 50 characters.');
  }
  if (!/^[A-Z0-9-]+$/.test(trimmed)) {
    throw new Error('Business ID can only contain letters, numbers, and hyphens (no spaces or special characters).');
  }
  return trimmed;
}

export function isValidBusinessCode(code: string | undefined | null): boolean {
  try {
    validateBusinessCode(code);
    return true;
  } catch (e) {
    return false;
  }
}
