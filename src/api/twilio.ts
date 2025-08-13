import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function notifyMe(text: string) {
  await client.messages.create({
    body: text,
    from: process.env.TWILIO_FROM_NUMBER!,
    to: process.env.MY_PHONE_NUMBER!
  });
}