export interface UserProfile {
  id: string;
  name: string;
  orders: string[];
}

// Simulates records from an untyped source (JSON file, DB row) trusted to match
// UserProfile. "carol" is missing `orders` -> the runtime bug App2 will heal.
const rawUsers: Record<string, unknown> = {
  alice: { id: 'alice', name: 'Alice', orders: ['o1', 'o2'] },
  bob: { id: 'bob', name: 'Bob', orders: ['o3'] },
  carol: { id: 'carol', name: 'Carol' },
};

export function findUser(id: string): UserProfile | undefined {
  return rawUsers[id] as UserProfile | undefined;
}
