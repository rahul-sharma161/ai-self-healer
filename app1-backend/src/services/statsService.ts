import { findUser } from '../models/userStore';

/** Returns how many orders the given user has placed. */
export function getOrderCount(userId: string): number {
  const profile = findUser(userId);
  if (!profile) {
    throw new Error(`Unknown user: ${userId}`);
  }
  return profile.orders.length;
}
