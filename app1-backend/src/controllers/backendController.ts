import type { Request, Response } from 'express';
import { getOrderCount } from '../services/statsService';
import { countItems } from '../services/apiService';
import { computeShare } from '../services/mathService';
import { logError } from '../utils/logger';

export function getOrders(req: Request, res: Response): void {
  const user = String(req.query.user ?? '');
  try {
    res.json({ user, orders: getOrderCount(user) });
  } catch (err) {
    void logError(err);
    res.status(500).json({ error: (err as Error).message });
  }
}

export function getItems(req: Request, res: Response): void {
  const key = String(req.query.key ?? '');
  try {
    res.json({ key, items: countItems(key) });
  } catch (err) {
    void logError(err);
    res.status(500).json({ error: (err as Error).message });
  }
}

export function getShare(req: Request, res: Response): void {
  const total = BigInt(String(req.query.total ?? '0'));
  const parts = BigInt(String(req.query.parts ?? '0'));
  try {
    res.json({ share: computeShare(total, parts).toString() });
  } catch (err) {
    void logError(err);
    res.status(500).json({ error: (err as Error).message });
  }
}
