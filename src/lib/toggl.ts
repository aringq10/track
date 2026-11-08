/*
  * https://engineering.toggl.com/docs/track/api/me/#get-projects
  * https://engineering.toggl.com/docs/track/api/time_entries/
*/

import { Buffer } from 'node:buffer';
import { Project, TimeEntries, TimeEntry } from './model.js';
import { formatDate, DAY } from './date.js';
import * as z from 'zod';

export type TimeEntriesParams = number | Date | [Date, Date];

export class Toggl {
  token: string;

  constructor(token: string) {
    this.token = token;
  }

  async fetchProjects(): Promise<Project[]> {
    let data = await this.fetch("me/projects");

    return z.array(Project).parse(data);
  }

  async fetchTimeEntries(params: TimeEntriesParams = Date.now() - DAY): Promise<TimeEntry[]> {
    let p: Record<string, string>;

    if (typeof params === "number") {
      params = Math.floor(params / 1000);
      p = { "since": params.toString() };
    } else if (params instanceof Date) {
      p = { "before": formatDate(params) }
    } else {
      const [startDate, endDate] = params;
      p = {
        "start_date": formatDate(startDate),
        "end_date": formatDate(endDate)
      }
    }

    let data = await this.fetch("me/time_entries", p);

    return TimeEntries.parse(data);
  }

  async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    const url = `https://api.track.toggl.com/api/v9/${endpoint}${qs ? `?${qs}` : ""}`;
    const auth = Buffer.from(this.token + ":api_token").toString('base64');
    let res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
    });

    if (!res.ok) {
      throw new Error(`Toggl API returned ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }
}
