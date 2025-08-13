import twilio, { Twilio } from 'twilio';
import logger from '../utils/logger.ts';

const twilioInit = (): Twilio => {

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH;
    try{
        logger.info("Initializing Twilio Client for SMS router")
        const twilioClient = twilio(accountSid, authToken);
        logger.info("Twilio Client Succesfully Initialized - SMS router established");
        return twilioClient;

    }catch (error) {
        logger.error({err: error}, "Twilio client failed to initialize")
        throw error;
    }

}

export default twilioInit;