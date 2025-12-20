import { config } from 'dotenv';
import { createApp } from './app.js';
import { logger } from './logging/logger.js';
import { configureGracefulShutdown } from './shutdown.js';

config();

const start = async () => {
  try {
    const app = await createApp();
    
    // Configure graceful shutdown
    configureGracefulShutdown(app);
    
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    
    logger.info(`Server running on port ${port}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

start();

