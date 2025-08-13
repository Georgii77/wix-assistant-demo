import express from 'express';
import { xss } from 'express-xss-sanitizer';
import { Index, Pinecone} from '@pinecone-database/pinecone';
import Twilio  from 'twilio';
import { createClient, type RedisClientType } from 'redis'
import 'dotenv/config';
import { wixWebHookRouter } from './handlers/webhook.ts';
import { createIndexIfNotExists } from './db/vectorDB.ts';
import type { LeadMeta } from '../types/lead.js';
import { PineconeNotFoundError } from '@pinecone-database/pinecone/dist/errors/http.js';
import { twilioInboundHandler } from './handlers/twilioInbound.ts';

if (!process.env.PINECONE_API_KEY) {
    throw new Error('Pinecone API key (PINECONE_API_KEY) is not defined in environment variables.');
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH;

const twilioClient = Twilio(accountSid, authToken);


const redisClient: RedisClientType = createClient({
    socket: {
        host: '',
        port: 0
    },
    username: process.env.REDIS_AUTH_USERNAME || 'default',
    password: process.env.REDIS_AUTH_PASSWORD || '',
});
redisClient.on('error', err => console.log('Redis Client Error', err));

await redisClient.connect();


const app = express();

const PORT = 3000;
const INDEX_NAME = 'wix-lead-index';

app.use(express.json());
app.use(xss());

const vectorDB = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

let vectorDBIndex: Index<LeadMeta>; 


(async () => {
    try {
    await vectorDB.describeIndex(INDEX_NAME)
    vectorDBIndex = vectorDB.Index(INDEX_NAME);
    console.log('VectorDB Index:', vectorDBIndex);

} catch (error) {
    if (error instanceof PineconeNotFoundError) {
        createIndexIfNotExists(INDEX_NAME, vectorDB)
        vectorDBIndex = vectorDB.Index(INDEX_NAME);
    } else {
        throw error;
    }
}
  
  app.use('/post-status', wixWebHookRouter(vectorDBIndex, twilioClient, redisClient));
  app.use('/twilio-inbound', express.urlencoded({ extended: false }), twilioInboundHandler(redisClient, twilioClient));

const instance = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

instance.on('error', (err) => {
  console.error('Server error event:', err);
}).on('close', () => {
  console.log('HTTP server handle closed – event-loop will drain.');
});


})();


