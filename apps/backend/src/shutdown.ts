import { FastifyInstance } from 'fastify';
import { logger } from './logging/logger.js';
import { closeQueue } from './queue/processing-queue.js';
import { getPrisma } from './services/database.js';

export function configureGracefulShutdown(app: FastifyInstance): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // Stop accepting new requests
        await app.close();
        logger.info('HTTP server closed');

        // Close queue connections
        await closeQueue();
        logger.info('Queue connections closed');

        // Close database connections
        await getPrisma().$disconnect();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }
}
