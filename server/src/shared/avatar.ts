import { AppError } from './errors.js';

const MAX_AVATAR_LEN = 16;
const SAFE_AVATAR = /^[A-Za-z0-9 .'-]{1,16}$/;

/** Wave 1: avatar is initials/placeholder only — reject data URLs / blobs. */
export function assertSafeAvatar(avatar: string | null | undefined): void {
  if (avatar == null || avatar === '') return;
  const v = avatar.trim();
  if (v.toLowerCase().startsWith('data:')) {
    throw new AppError(400, 'AVATAR_REJECTED', 'data: image URLs are not allowed for avatar.');
  }
  if (v.includes('base64') || v.length > MAX_AVATAR_LEN) {
    throw new AppError(400, 'AVATAR_REJECTED', 'Avatar must be a short placeholder (e.g. initials).');
  }
  if (!SAFE_AVATAR.test(v)) {
    throw new AppError(400, 'AVATAR_REJECTED', 'Avatar contains unsupported characters.');
  }
}
