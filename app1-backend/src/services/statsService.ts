import { findUser } from '../models/userStore';

/** Returns how many orders the given user has placed. */
export function getOrderCount(userId: string): number {
  const profile = findUser(userId);
  if (!profile) {
    return 0;
  }
  return profile.orders?.length ?? 0;
}
