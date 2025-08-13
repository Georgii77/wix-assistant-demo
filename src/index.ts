// Express and dependencies
import express from 'express';
import { xss } from 'express-xss-sanitizer';

// Service Init modules
import twilioInit from './lib/twilio.ts';
import redisInit from './lib/redis.ts';

// Routes
import { wixWebHookRouter } from './handlers/webhook.ts';
import { twilioInboundHandler } from './handlers/twilioInbound.ts';

// Utils
import 'dotenv/config';
import logger from './utils/logger.ts';

// Express server Port
const PORT = 3000;


const twilioClient = twilioInit();

const redisClient = await redisInit();

const app = express();



app.use(express.json());
app.use(xss());

  
  app.use('/post-status', wixWebHookRouter(twilioClient, redisClient));
  app.use('/twilio-inbound', express.urlencoded({ extended: false }), twilioInboundHandler(redisClient, twilioClient));

const appInstance = app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

appInstance.on('error', (err) => {
  logger.error({err},'Server error');
}).on('close', () => {
  logger.info('HTTP server handle closed – event-loop will drain.');
});




