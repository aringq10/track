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
  activeDays: number
}

export class Data {
  database: DatabaseSync;

  constructor(dbPath: string, schemaPath?: string) {
    this.database = new DatabaseSync(dbPath);
    if (schemaPath !== undefined) {
      const schema = readFileSync(schemaPath).toString();
      this.database.exec(schema);
    }
  }

  async update(token: string) {
    const api = new Toggl(token);

    const projects = await api.fetchProjects();
    const timeEntries = await api.fetchTimeEntries();

    this.insertProjects(projects);
    this.insertTimeEntries(timeEntries);
  }

  insertProjects(projects: Project[]): boolean {
    const stmt = this.database.prepare(
      `INSERT INTO project(id, name)
       VALUES (?, ?)`
    );

    try {
      this.database.exec('BEGIN');
      for (const p of projects) {
        stmt.all(p.id, p.name);
      }
      this.database.exec('END');
      return true;
    } catch {
      this.database.exec("ROLLBACK");
      return false;
    }
  }

  insertTimeEntries(timeEntries: TimeEntry[]): boolean {
    const stmt = this.database.prepare(
      `INSERT INTO time_entry(id, project_id, start, stop, description)
       VALUES (?, ?, datetime(?), datetime(?), ?)`
    );

    try {
      this.database.exec('BEGIN');
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
      return true;
    } catch {
      this.database.exec("ROLLBACK");
      return false;
    }
  }

  getProjects(): Project[] {
    return this.database.prepare(
      `SELECT * FROM project;`
    ).all() as Project[];
  }

  getProjectSumarries(range: { from: Date, to: Date }): ProjectSummary[] {
    const query = `
      WITH days AS (
        SELECT DISTINCT
          date(start) AS day,
          name,
          SUM(unixepoch(stop) - unixepoch(start)) AS duration
        FROM project
        JOIN time_entry
          ON project.id=project_id
        WHERE date(start) >= ? AND date(start) <= ?
        GROUP BY 1, 2
      )
      SELECT
        name AS projectName,
        SUM(duration) AS totalDuration,
        COUNT(*) AS activeDays
      FROM days
      GROUP BY name;
    `;

    const l = this.database.prepare(query)
      .all(formatDate(range.from), formatDate(range.to));

    return l.map(p => ({
      projectName: p.projectName as string,
      totalDuration: (p.totalDuration as number | null) ?? 0,
      activeDays: p.activeDays as number
    }));
  }

  getTimeEntries(range: { from: Date, to: Date }): TimeEntryExt[] {
    const l = this.database.prepare(`
      SELECT
        *,
        unixepoch(stop) - unixepoch(start) AS duration
      FROM time_entry
      LEFT JOIN project
        ON project_id=project.id
      WHERE date(start) >= ? AND date(start) <= ?`
      ).all(formatDate(range.from), formatDate(range.to));

    return l.map(t => {
      const startDate = new Date(t.start as string);
      const stopDate = t.stop
        ? new Date(t.stop as string)
        : null;
      return {
        projectName: t.name as string | null,
        start: startDate,
        stop: stopDate,
        duration: t.duration as number | null,
        description: t.description as string | null
      };
    })
  }

  getView(range: { from: Date, to: Date }): PageView {
    const entriesPerDay = groupTimeEntries(this.getTimeEntries(range)).
      map(({ date, totalDuration, entries }) => ({ date, totalDuration, entries: entries.map(toView) }));

    const totalDays = dayRange(range.from, range.to);

    const projects = this.getProjectSumarries(range).map(v => summaryToView(v, totalDays));

    return {
      startDate: formatDate(range.from),
      endDate: formatDate(range.to),
      projects,
      entriesPerDay
    }
  }
}
