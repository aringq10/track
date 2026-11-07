import { Data  } from './lib/data.js';
import express from "express";
import { parseDate, WEEK } from './lib/date.js';
import path from 'node:path';

const PORT = 4321;

const dir = import.meta.dirname;

const token = process.env.API_TOKEN;
if (!token) throw new Error("API_TOKEN is not set");

const data = new Data(path.join(dir, "../main.db"), path.join(dir, "sql/schema.sql"));

/* express server */

const app = express();

app.locals.basedir = path.join(dir, "views");

app.set("views", path.join(dir, "views"));
app.set("view engine", "pug");

app.use(express.static(path.join(dir, "public")));

app.get('/', (req, res) => {
  const s = req.query.startDate;
  const e = req.query.endDate;
  const startDate = typeof s === "string"
    ? parseDate(s)
    : null;
  const endDate = typeof e === "string"
    ? parseDate(e)
    : null;
  const bothUndefined = s === undefined && e === undefined;
  const badRequest =
    (startDate === null || endDate === null) &&
    !bothUndefined;

  if (badRequest) {
    res.status(400).render("error", { code: 400, message: "Bad Request"});
  } else {
    const now = new Date();
    const filter = bothUndefined
      ? { from: new Date(now.getTime() - WEEK), to: now}
      : { from: startDate!, to: endDate! };
    res.render('index', data.getView(filter));
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`listening on http://localhost:${PORT}`));
