import { config } from './config/index';
import { watchLog } from './services/logWatcher';
import { handleError } from './controllers/healController';
import { log } from './utils/logger';

log.info('self-healing assistant started', { model: config.model, watching: config.logPath });

watchLog(config.logPath, handleError);
