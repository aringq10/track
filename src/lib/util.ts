import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function select(options: string[]): Promise<number> {
  const rl = readline.createInterface({ input, output });
  let selection: number | null = null;

  while (selection === null) {
    options.forEach((o, i) => {
      console.log(`[${i + 1}] ${o}`);
    })

    const answer = await rl.question(`Choose ${1}-${options.length}: `);
    const s = parseInt(answer, 10);
    if (!isNaN(s) && s >= 1 && s <= options.length) {
      selection = s - 1;
      break;
    }
  }

  rl.close();

  return selection;
}
