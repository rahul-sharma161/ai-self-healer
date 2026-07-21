import express from 'express';
import { routes } from './routes/index';
import { startDriver } from './driver';

const PORT = Number(process.env.PORT ?? 3000);
const app = express();
app.use(routes);

app.listen(PORT, () => {
  console.log(`[app1] backend listening on http://localhost:${PORT}`);
  startDriver();
});
