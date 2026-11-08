import { open } from 'node:fs/promises';
import { exit } from 'node:process';
import path, { resolve } from 'node:path';
import { Data } from './lib/data.js';
import { TimeEntriesParams, Toggl } from './lib/toggl.js';
import { Project, TimeEntry } from './lib/model.js';
import * as z from 'zod';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseDate } from './lib/date.js';

const dir = import.meta.dirname;

const dbPath = process.env.DB_PATH ?? path.join(dir, "../main.db");

const token = process.env.API_TOKEN;
if (!token) throw new Error("API_TOKEN is not set");

const data = new Data(dbPath);
const api = new Toggl(token);

type Action = [
  string, // command name
  string, // usage
  string, // description
  (args: string[]) => void | Promise<void> // callback, args contain non-empty strings
]

const actions: Action[]= [
  [
    ".insP",
    "<file>",
    "insert projects from json file",
    async (args) => {
      if (args.length !== 1) {
        console.error("incorrect usage");
        return;
      }
      const fn = args[0]!;
      const fh = await open(fn, 'r');
      try {
        const json = await fh.readFile('utf8');
        const projects = z.array(Project).parse(JSON.parse(json));
        const inserted = data.insertProjects(projects);
        console.log(
          inserted ? `Inserted ${projects.length} projects from ${resolve(fn)}`
                   : "Insertion failed");
      } finally {
        fh.close();
      }
    }
  ],
  [
    ".insT",
    "<file>",
    "insert time entries from json file",
    async (args) => {
      if (args.length !== 1) {
        console.error("incorrect usage");
        return;
      }
      const fn = args[0]!;
      const fh = await open(fn, 'r');
      try {
        const json = await fh.readFile('utf8');
        const timeEntries = z.array(TimeEntry).parse(JSON.parse(json));
        const inserted = data.insertTimeEntries(timeEntries);
        console.log(
          inserted ? `Inserted ${timeEntries.length} time entries from ${resolve(fn)}`
                   : "Insertion failed");
      } finally {
        fh.close();
      }
    }
  ],
  [
    ".listP",
    "",
    "list projects",
    () => {
      const p = data.getProjects();
      if (p.length === 0) console.log("No projects");
      else console.table(p);
    }
  ],
  [
    ".listT",
    "<from> <to>",
    "list time entries",
    (args) => {
      if (args.length !== 2) {
        console.error("incorrect usage");
        return;
      }
      const [from, to] = [parseDate(args[0]!), parseDate(args[1]!)]
      if (from === null || to === null || from > to) {
        console.error("invalid dates");
        return;
      }
      const t = data.getTimeEntries({ from, to });
      if (t.length === 0) console.log("No time entries");
      else console.table(t);
    }
  ],
  [
    ".fetchP",
    "<file>",
    "fetch projects to json file",
    async (args) => {
      if (args.length !== 1) {
        console.error("incorrect usage");
        return;
      }
      const fn = args[0]!;
      const fh = await open(fn, 'w');
      try {
        await fh.writeFile(JSON.stringify(await api.fetchProjects()), 'utf8');
        console.log(`Wrote to ${resolve(fn)}`)
      } finally {
        fh.close();
      }
    }
  ],
  [
    ".fetchT",
    "<file> [<from> <to>]",
    "fetch time entries to json file",
    async (args) => {
      let params: TimeEntriesParams | undefined = undefined;
      if (args.length !== 1 && args.length !== 3) {
        console.error("incorrect usage");
        return;
      } else if (args.length === 3) {
        const [from, to] = [parseDate(args[1]!), parseDate(args[2]!)];
        if (from === null || to === null || from > to) {
          console.error("invalid dates");
          return;
        }
        params = [from, to];
      }
      const fn = args[0]!;
      const fh = await open(fn, 'w');
      try {
        await fh.writeFile(JSON.stringify(await api.fetchTimeEntries(params)), 'utf8');
        console.log(`Wrote to ${resolve(fn)}`)
      } finally {
        fh.close();
      }
    }
  ],
  [
    ".fetchAll", "", "run updateDb",
    async () => await data.update(token)
  ],
  [
    ".quit", "", "",
    () => exit()
  ],
  [
    ".help", "", "",
    () => help(),
  ]
];

function help() {
  const maxWidth = actions.map(([cmd, usage, , ]) => cmd.length + (usage ? 1 + usage.length : 0))
    .reduce((p, c) => Math.max(p, c));

  for (const a of actions) {
    const [cmd, usage, desc] = a;
    const leftSide = `${cmd}${usage ? " " + usage : ""}`.padEnd(maxWidth);
    console.log(`${leftSide}  ${desc}`);
  }
}

async function start() {
  console.log("type .help to see available commands");
  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      try {
        const [cmd, ...args] = (await rl.question("> ")).split(" ").filter(Boolean);

        let i;
        if (
          cmd === undefined
          || (i = actions.map(([cmd]) => cmd).indexOf(cmd)) === -1
        ) {
          console.error("unknown command");
          continue;
        }

        await actions[i]![3](args);
      } catch (e) {
        if (!(e instanceof Error)) e = new Error(String(e));
        else console.error(`Error: ${e.message}`);
      }
    }
  } finally {
    rl.close();
  }
}

await start();
