import express, { type Request, type Response} from 'express';
import { leadHandler} from '../db/vectorDB.ts'; 
import type { Index } from '@pinecone-database/pinecone';
import type { LeadMeta } from '../../types/lead.js';
import llmChain from '../ai/langChain.ts';
import type { Twilio } from 'twilio';
import { parseLeadData } from '../utils/leadParser.ts';
import type {  RedisClientType } from 'redis';
import { randomUUID } from 'crypto';

export function wixWebHookRouter(twilioClient: Twilio, redisClient: RedisClientType): express.Router {

const webHookHandler = express.Router();

webHookHandler.post('/', async (req: Request, res: Response) => {

   const leadData = JSON.stringify(parseLeadData(req.body), null , 2);

  try{


    const messageInstance = await twilioClient.messages.create({
        body: leadData,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: process.env.TWILIO_PHONE_NUMBER || ""
    })
    console.log('Twilio message sent:', messageInstance.sid, "Message status",messageInstance.status, "Error code", messageInstance.errorCode);

      const id = randomUUID();  
      const redisUploader = await redisClient.multi()
                                                    .set(`messageID:${id}`, leadData)
                                                    .zAdd("messageKeysSorted", [
                                                      { score: Date.now(), value: `messageID:${id}` }
                                                    ])
                                                    .exec();


      if (redisUploader !== null) {
        console.log('Redis message uploaded:', redisUploader);
      } else {
        console.log('Redis message upload returned null');
      }
    }catch (error) {console.error('Error in webhook handler:', error);}


    console.log('Received webhook data, generating AI response...');

  

    const llmResponse = await Promise.all([
            llmChain(req.body),
            llmChain(req.body),
            llmChain(req.body)
          ]);

    const results = llmResponse.map((response, index) => `Response ${index + 1}: \n  ${response}`);

    for (const message of results){

    const messageInstance = await twilioClient.messages
    .create({
        body: message,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: process.env.TWILIO_PHONE_NUMBER || ""
    })
    console.log('Twilio message sent:', messageInstance.sid, "Message status",messageInstance.status, "Error code", messageInstance.errorCode);

      const id = randomUUID();  
      const redisUploader = await redisClient.multi()
                                                    .set(`messageID:${id}`, message)
                                                    .zAdd("messageKeysSorted", [
                                                      { score: Date.now(), value: `messageID:${id}` }
                                                    ])
                                                    .exec();


      if (redisUploader !== null) {
        console.log('Redis message uploaded:', redisUploader);
      } else {
        console.log('Redis message upload returned null');
      }
    }

    res.status(200).send('Lead data processed successfully');
  
  

});

  return webHookHandler;
}
export default wixWebHookRouter;
