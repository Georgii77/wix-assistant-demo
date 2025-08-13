import { randomUUID } from 'crypto';
import express, { type Request, type Response} from 'express';
import type { RedisClientType} from 'redis';
import { iterationAgent } from '../ai/langChain.ts';
import type { Twilio } from 'twilio';
import { sendWithGmailAPI } from "../api/googleRefreshToken.ts";
import logger from '../utils/logger.ts';

export function twilioInboundHandler(redisClient: RedisClientType, twilioClient: Twilio): express.Router {

    const twilioInboundHandler = express.Router();
    
    twilioInboundHandler.post('/', async (req: Request, res: Response) => {

        if(req.body.From !== process.env.TWILIO_PHONE_NUMBER){
            res.status(403).send('Forbidden');
            return;
        }

        try {
            
            let messageHistory = await getMessageHistory(redisClient);

            const inboundId = randomUUID();  
            
            const inboundUploader = await redisClient.multi()
                                  .set(`messageID:${inboundId}`, JSON.stringify(req.body))
                                  .zAdd("messageKeysSorted", [
                                    { score: Date.now(), value: `messageID:${inboundId}` }
                                  ])
                                  .exec();

    
            if (inboundUploader !== null) {
            logger.info('Redis message uploaded');
            } else {
            logger.info('Redis message upload failed');
            }

            messageHistory.smsResponse = req.body;

            let llmResponse: { llmOutput: string; redisFlush: boolean; };
            try{
              llmResponse = await iterationAgent(messageHistory, redisClient);
              console.log('LLM Response:', llmResponse);
            }
            catch(err)
            {
              res.status(503);

              const messageInstance = await twilioClient.messages.create({
              body: "Internal Error Occured - Conversation Termination",
              messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
              to: process.env.TWILIO_PHONE_NUMBER || ""})

              await redisClient.sendCommand(["FLUSHDB", "ASYNC"]);

              return;
            }

             const id = randomUUID();  

            const redisUploader = await redisClient.multi()
                              .set(`messageID:${id}`, `LLM response: <${llmResponse}>`)
                              .zAdd("messageKeysSorted", [
                                { score: Date.now(), value: `messageID:${id}` }
                              ])
                              .exec();

            if (redisUploader !== null) {
            logger.info('Redis message uploaded');
            } else {
            logger.error('Redis message upload failed');
            }
    

            const messageInstance = await twilioClient.messages
            .create({
                body: llmResponse.llmOutput,
                messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
                to: process.env.TWILIO_PHONE_NUMBER || ""
            })


            if (llmResponse.redisFlush) {

              const emailBody =  llmResponse.llmOutput.match(/<<([\s\S]*?)>>/)?.[1].trim() ?? "";

              const [oldestKey] = await redisClient.zRange("messageKeysSorted", 0, 0);

              if (!oldestKey){

                res.status(503)

                logger.error("Email retrieval failed");

                const messageInstance = await twilioClient.messages.create({
                body: "Internal Error Occured - Conversation Termination",
                messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
                to: process.env.TWILIO_PHONE_NUMBER || ""})

                await redisClient.sendCommand(["FLUSHDB", "ASYNC"]);

              return;
              }

              const raw = await redisClient.get(oldestKey);

              const emailRaw = JSON.parse(raw!).contact.email;
              const email = String(emailRaw)
                .replace(/[\r\n]/g, "")
                .replace(/^"+|"+$/g, "")      
                .replace(/^\s*<(.+?)>\s*$/, "$1") 
                .trim();

              try {
                    await sendWithGmailAPI({
                      from: "",
                      to: email,
                      subject: "",
                      text: emailBody,
                    });
                    logger.info("Email sent successfully!");
                  } catch (err) {
                    logger.error({err},"Error sending email");
                 }
                await redisClient.sendCommand(["FLUSHDB", "ASYNC"]);

                logger.info('Redis database flushed as per LLM instruction.');

          }
               
        } catch (error) {
            logger.error({error},'Error processing Twilio inbound request');
            res.status(500).send('Internal Server Error');
        }
    });

    return twilioInboundHandler;
}

async function getMessageHistory(redisClient: RedisClientType): Promise<Record<string, string | null>> {
  try {

     let cursor = '0';
     const messageHistory: Record<string, string | null> = {};

     do {
   
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor);
    cursor = nextCursor;

    if (Array.isArray(keys) && keys.length > 0 && keys.every(k => typeof k === 'string')) {
      const values = await redisClient.mGet(keys);
      keys.forEach((value, idx) => {
        messageHistory[value] = values[idx];
      });
    }
  } while (cursor !== '0');
 

    return messageHistory;
    
  } catch (error) {
    console.error('Error retrieving message history from Redis:', error);
    throw error;
  }
}



