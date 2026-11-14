import { DatabaseSync } from 'node:sqlite';
import { Project, TimeEntry } from './model.js';
import { Toggl } from './toggl.js';
import { dayRange, formatDate } from './date.js';
import { groupTimeEntries, PageView, summaryToView, toView } from './view.js';
import { readFileSync } from 'fs';

export type TimeEntryExt = Omit<TimeEntry, "id" | "project_id"> & {
  projectName: string | null,
  duration: number | null
}

export type ProjectSummary = {
  projectName: string,
  totalDuration: number,
  activeDays: number,
  days: boolean[]
}

const getTimeEntriesQuery = `
  SELECT
      p.name AS projectName,
      datetime(t.start, ?1) AS start_s,
      datetime(t.stop, ?1) AS stop_s,
      unixepoch(t.stop) - unixepoch(t.start) AS duration,
      t.description
  FROM time_entry AS t
  LEFT JOIN project AS p
    ON t.project_id=p.id
  WHERE date(start_s) >= ?2 AND date(start_s) <= ?3
  ORDER BY start_s DESC`;

const getProjectSummariesQuery = `
  WITH RECURSIVE
    dates(d) AS (
       SELECT ?2
       UNION ALL
       SELECT date(d, '1 day') AS d_t FROM dates
        WHERE d_t <= ?3
    )
  SELECT
      d AS day,
      p.name AS projectName,
      COUNT(t.id) AS entriesCount,
      COALESCE(SUM(unixepoch(t.stop) - unixepoch(t.start)), 0) AS totalDuration
  FROM dates
  LEFT JOIN project AS p
      ON TRUE
  LEFT JOIN time_entry AS t
      ON p.id=t.project_id AND d=date(t.start, ?1)
  GROUP BY 1, 2
  ORDER BY 2, 1`;

export class Data {
  database: DatabaseSync;

  constructor(dbPath: string, schemaPath?: string) {
    this.database = new DatabaseSync(dbPath);
    if (schemaPath !== undefined) {
      const schema = readFileSync(schemaPath).toString();
      this.database.exec(schema);
    }
  }

  async update(token: string): Promise<{ p: number, t: number }> {
    const api = new Toggl(token);

    const projects = await api.fetchProjects();
    const timeEntries = await api.fetchTimeEntries();

    this.insertProjects(projects, true);
    this.insertTimeEntries(timeEntries, true);

    return { p: projects.length, t: timeEntries.length }
  }

  insertProjects(projects: Project[], dontEnd: boolean = false) {
    const stmt = this.database.prepare(
      `INSERT INTO project(id, name)
       VALUES (?, ?)`
    );

    try {
      this.database.exec('BEGIN');
      for (const p of projects) {
        stmt.all(p.id, p.name);
      }
      if (!dontEnd) this.database.exec('END');
    } catch (e) {
      this.database.exec("ROLLBACK");
      throw e;
    }
  }

  insertTimeEntries(timeEntries: TimeEntry[], dontBegin: boolean = false) {
    const stmt = this.database.prepare(
      `INSERT INTO time_entry(id, project_id, start, stop, description)
       VALUES (?, ?, datetime(?), datetime(?), ?)`
    );

    try {
      if (!dontBegin) this.database.exec('BEGIN');
      for (const t of timeEntries) {
        stmt.all(
          t.id,
          t.project_id,
          t.start.toISOString(),
          t.stop?.toISOString() ?? null,
          t.description
        );
      }
      this.database.exec('END');
    } catch (e) {
      this.database.exec("ROLLBACK");
      throw e;
    }
  }

  getProjects(): Project[] {
    return this.database.prepare(
      `SELECT * FROM project;`
    ).all() as Project[];
  }

  getProjectSumarries(filter: { from: Date, to: Date, timezone: string }): ProjectSummary[] {
    const l = this.database.prepare(getProjectSummariesQuery)
      .all(filter.timezone, formatDate(filter.from), formatDate(filter.to)) as {
        day: string,
        projectName: string,
        entriesCount: number,
        totalDuration: number
      }[];

    const byProject: Map<string, ProjectSummary> = new Map();

    for (const i of l) {
      let p: ProjectSummary | undefined;
      const activeDay = i.entriesCount !== 0;
      if ((p = byProject.get(i.projectName)) !== undefined) {
        p.totalDuration += i.totalDuration;
        p.activeDays += activeDay ? 1 : 0;
        p.days.push(activeDay);
      } else {
        byProject.set(i.projectName, {
          projectName: i.projectName,
          totalDuration: i.totalDuration,
          activeDays: activeDay ? 1 : 0,
          days: [activeDay]
        })
      }
    }

    return Array.from(byProject.values());
  }

  getTimeEntries(filter: { from: Date, to: Date, timezone: string }): TimeEntryExt[] {
    const l = this.database.prepare(getTimeEntriesQuery)
      .all(filter.timezone, formatDate(filter.from), formatDate(filter.to));

    return l.map(t => {
      const startDate = new Date((t.start_s as string) + "Z");
      const stopDate = t.stop_s
        ? new Date((t.stop_s as string) + "Z")
        : null;
      return {
        projectName: t.projectName as string | null,
        start: startDate,
        stop: stopDate,
        duration: t.duration as number | null,
        description: t.description as string | null
      };
    })
  }

  getView(filter: { from: Date, to: Date, timezone: string }): PageView {
    this.database.exec("BEGIN");
    const entriesPerDay = groupTimeEntries(this.getTimeEntries(filter)).
      map(({ date, totalDuration, entries }) => ({ date, totalDuration, entries: entries.map(toView) }));

    const totalDays = dayRange(filter.from, filter.to);

    const projects = this.getProjectSumarries(filter).map(v => summaryToView(v, totalDays));

    this.database.exec("COMMIT");

    return {
      startDate: formatDate(filter.from),
      endDate: formatDate(filter.to),
      projects,
      entriesPerDay
    }
  }
}
