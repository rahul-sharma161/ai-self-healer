import { Router } from 'express';
import { getOrders, getItems, getShare } from '../controllers/backendController';

export const routes = Router();
routes.get('/orders', getOrders);
routes.get('/items', getItems);
routes.get('/share', getShare);
