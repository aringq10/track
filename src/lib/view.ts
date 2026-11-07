import { ProjectSummary, TimeEntryExt } from "./data.js";
import { formatDate, formatDuration, formatTime } from "./date.js";

export interface PageView {
  startDate: string,
  endDate: string,
  projects: ProjectSummaryView[],
  entriesPerDay: {
    date: string,
    totalDuration: string,
    entries: TimeEntryView[]
  }[]
}

export interface TimeEntryView {
  projectName: string,
  start: string,
  stop: string,
  duration: string,
  description: string
}

export interface ProjectSummaryView {
  projectName: string,
  totalDuration: string,
  totalDays: string,
  activeDays: string,
  pctgActTot: string, // activeDays / totalDays
  durPerDay: string,
  durPerAct: string
}

export function toView(t: TimeEntryExt): TimeEntryView {
  return {
    projectName: t.projectName ?? "NaN",
    start: formatTime(t.start),
    stop: t.stop ? formatTime(t.stop) : "Nan",
    duration: t.duration ? formatDuration(t.duration) : "NaN",
    description: t.description ?? ""
  };
}

export function summaryToView(p: ProjectSummary, totalDays: number): ProjectSummaryView {
  const pctgActTot = (100 * (p.activeDays / totalDays)).toFixed(1);
  return {
    projectName: p.projectName,
    totalDuration: formatDuration(p.totalDuration),
    totalDays: totalDays.toString(),
    activeDays: p.activeDays.toString(),
    pctgActTot,
    durPerDay: formatDuration(p.totalDuration / totalDays),
    durPerAct: formatDuration(p.totalDuration / p.activeDays)
  }
}

export function groupTimeEntries(
  items: TimeEntryExt[]
): { date: string, totalDuration: string, entries: TimeEntryExt[] }[] {
  const groups = new Map<string, TimeEntryExt[]>();
  for (const item of items) {
    const key = formatDate(item.start);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, bucket]) => ({
      date,
      totalDuration: formatDuration(bucket.reduce((p, c) => {
        return p + (c.duration ?? 0)
      }, 0)),
      entries: bucket
    }));
}
