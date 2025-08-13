import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Runnable, RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { RedisClientType} from 'redis';
import * as fs from "fs";



export default async function incomingLeadChain(data: any): Promise<string> {

  const prompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a polite lead assistant, your goal is to be in charge of answering the first message customers for a business send when getting in touch. You have to answer in french or english based on the language used by the lead. \n
    Here is some more description about the business: we are a siberian cat cattery based in quebec, sainte-adele. WEve been doing this for 7 years now, our cattery uses cca certifications. We offer 1 year garuantee againts genetic and congetinal diseeas that could cause death,
    we work with a 200 cad deposit that is refunded when the cat is sterelized around the age of 6 months. THis is because they care too young yet to be operated. Our cats prices range from 1900 to 3000 cad with neva masquerade ones being mostly 1900-2100 price point. All numbers
    are tax included. We let our kittens go by the age of 3 months, by that point they get 2 vaccinations, deworming. Visists start around 2 months of age, we do not allow visits before that because we want to make sure the kittens are healthy and strong enough to handle the stress of a visit.
    Most leads will first ask for an allergy test, those are free and usually done on the weekend but we can arrange for a visit during the week. Usually we ask the client what dates are the most comfortable with them and we try to accomodate them as much as possible. Its important to ask
    about what kind of allergies they are dealing with. Visits are free and should idealy last about 1 hour. If we dont have available kittens at this time we offer a 400 cad deposit that allows them to reserve a kitten. WHen talking to leads, your number one priority is to
    remember that its a small business so NEVER suggest answers that are over extending themselves. The area that you will handle will be purely informational, just to handle those that set foot in the door, if they have questions answer based on examples and given information, if they 
    want to visit, ask when would they like to come as well as what they are looking for if they didnt specify yet. 
    Use the following examples to understand how to answer {examples}, BUT this is an example of how to answer, you should not copy paste it, you should use it as a guide to write your own answer based on the lead data.\n if they write about their experience with cats you can say that they are a great fit 
    and we hope that a visit could help them decide if a siberian cat is good for them. Also, answer only in the language that they used in their lead message. VERY IMPORTANT TO KEEP IT CONCISE IF YOU ARE PROVIDING A LOT OF INFORMATION, nbever use the word rehome`],
  ["user",   "Here is the lead data:\n{lead}\n\nWrite a one-sentence reply."]
]);


const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model:  "gpt-5-mini",
});


const toText = new StringOutputParser();


const chain = RunnableSequence.from([prompt, llm, toText]);

  const examples = fs.readFileSync('src/static/examples.txt', 'utf-8');
  const lead: string = JSON.stringify(data, null, 2)

  const replyText: string = await chain.invoke({examples: examples, lead: lead});

  console.log("\n--- GPT reply ---\n", replyText);
  return replyText;
};

export async function iterationLLM(data: Record<string, string | null>, redisClient: RedisClientType): Promise<{llmOutput: string; redisFlush: boolean}> {


   const prompt = ChatPromptTemplate.fromMessages([
  ["system", ` (manager = lead handler)You are a polite lead assistant, your goal is to be in charge of answering the first message customers for a business send when getting in touch. You have to answer in french or english based on the language used by the lead. \n
    Here is some more description about the business: we are a siberian cat cattery based in quebec, sainte-adele. WEve been doing this for 7 years now, our cattery uses cca certifications. We offer 1 year garuantee againts genetic and congetinal diseeas that could cause death,
    we work with a 200 cad deposit that is refunded when the cat is sterelized around the age of 6 months. THis is because they care too young yet to be operated. Our cats prices range from 1900 to 3000 cad with neva masquerade ones being mostly 1900-2100 price point. All numbers
    are tax included. We let our kittens go by the age of 3 months, by that point they get 2 vaccinations, deworming. Visists start around 2 months of age, we do not allow visits before that because we want to make sure the kittens are healthy and strong enough to handle the stress of a visit.
    Most leads will first ask for an allergy test, those are free and usually done on the weekend but we can arrange for a visit during the week. Usually we ask the client what dates are the most comfortable with them and we try to accomodate them as much as possible. Its important to ask
    about what kind of allergies they are dealing with. Visits are free and should idealy last about 1 hour. If we dont have available kittens at this time we offer a 400 cad deposit that allows them to reserve a kitten. WHen talking to leads, your number one priority is to
    remember that its a small business so NEVER suggest answers that are over extending themselves. The area that you will handle will be purely informational, just to handle those that set foot in the door, if they have questions answer based on examples and given information, if they 
    want to visit, ask when would they like to come as well as what they are looking for if they didnt specify yet. You are exposed to 3 of your generated responses.
    Use the following examples to guide you on how to answer {examples}, BUT this is an example of how to answer, you should not copy paste it, you should use it as a guide to write your own answer based on the lead data.\n if they write about their experience with cats you can say that they are a great fit 
    and we hope that a visit could help them decide if a siberian cat is good for them. Also, answer only in the language that they used in their lead message. YOur secondary goal is to lead a conversation with the lead handler, the lead handler is communicating with you trhough text and has received your initila
    response, he might want to re iterate over the message. Howver if the text says that it wants to proceed with the generated response you need to output a single string for further llm tooling. If the manager says it wants response 1, you responsed with the format <<ok>>:<< the response 1 (the actuall text)>>. 
    if the manager has re iteraed a couple of times and when AND ONLY WHEN the manager says that you may send the message then you should output <<ok>>:<<the custom response>> otherwise you are leading a conversation with the lead handler and helping him refine the response. Never assume statisfaction in a text where the use 
    still refines the output. Always doouble check and output the satisfaction only when the maanger explicitly says so. VERY IMPORTANT TO KEEP IT CONCISE IF YOU ARE PROVIDING A LOT OF INFORMATION nbever use the word rehome unles specified by user`], 
  ["user",   "Here is the conversation data, the suggestiosn with the original lead data and the  conversation with the lead handler use it to change your response according the sms response:\n{messageHistory}\n\n"]
]);

const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model:  "gpt-5-mini",
});
const toText = new StringOutputParser();

const validation = new outputValidation(redisClient);

const chain = RunnableSequence.from([prompt, llm, toText, validation]);

const examples = fs.readFileSync('src/static/examples.txt', 'utf-8');

const replyText: {llmOutput: string; redisFlush: boolean} = await chain.invoke({examples: examples, messageHistory: data});


  return replyText;

}

class outputValidation extends Runnable<string,{llmOutput: string; redisFlush: boolean}> {
  
  private redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    
    super();
    this.redisClient = redisClient;

  }

  lc_namespace = ["langChain", "tools",  "outputValidation"];

  async invoke(input: string): Promise<{llmOutput: string; redisFlush: boolean}> {
    console.log("Input to the LLM:", input);
    
    if (input.trim().toLowerCase().startsWith("<<ok>>:")) {
      const customResponse = input.split("<<ok>>:")[1].trim();
      return {
        llmOutput: "Message finalized with custom response: \n\n" + customResponse + "\n\nMessage sent to lead by email.",
        redisFlush: true
      };
    }

    return {
      llmOutput: input,
      redisFlush: false
    };
  }
}


