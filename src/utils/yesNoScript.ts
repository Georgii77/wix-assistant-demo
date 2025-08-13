import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";


export async function yesNoPrompt(
  message: string
): Promise<boolean> {
  
  const rl = readline.createInterface({ input, output });

  return new Promise<boolean>((resolve) => {
    rl.question(message, (raw) => {
      rl.close();
      const txt = raw.trim().toLowerCase();

     
      if (["y", "yes"].includes(txt)) return resolve(true);
      if (["n", "no"].includes(txt)) return resolve(false);

      
      yesNoPrompt(message).then(resolve);
    });
  });
}
