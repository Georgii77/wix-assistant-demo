import { randomUUID } from 'crypto';
import express, { type Request, type Response} from 'express';
import type { RedisClientType} from 'redis';
import { iterationLLM } from '../ai/langChain.ts';
import type { Twilio } from 'twilio';
import { sendWithGmailAPI } from "../api/googleRefreshToken.ts";

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
            console.log('Redis message uploaded:', inboundUploader);
            } else {
            console.log('Redis message upload returned null');
            }


            messageHistory.smsResponse = req.body;

            const llmResponse = await iterationLLM(messageHistory, redisClient);
            console.log('LLM Response:', llmResponse);

             const id = randomUUID();  

            const redisUploader = await redisClient.multi()
                              .set(`messageID:${id}`, `LLM response: <${llmResponse}>`)
                              .zAdd("messageKeysSorted", [
                                { score: Date.now(), value: `messageID:${id}` }
                              ])
                              .exec();

    
            if (redisUploader !== null) {
            console.log('Redis message uploaded:', redisUploader);
            } else {
            console.log('Redis message upload returned null');
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

              if (oldestKey) {
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
                    console.log("Email sent successfully!");
                  } catch (err) {
                    console.error("Error sending email:", err);
                 }
                await redisClient.sendCommand(["FLUSHDB", "ASYNC"]);

                console.log('Redis database flushed as per LLM instruction.');
            }
          }
            console.log('Twilio message sent:', messageInstance.sid, "Message status",messageInstance.status, "Error code", messageInstance.errorCode);


               
        } catch (error) {
            console.error('Error processing Twilio inbound request:', error);
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



