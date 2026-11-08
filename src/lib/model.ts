import * as z from 'zod';

const IsoDate = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s))
  .refine((d) => !isNaN(d.getTime()), "Invalid date");

export const Project = z.object({
  id: z.number(),
  name: z.string()
});

const TimeEntryRaw = z.object({
  id: z.number(),
  project_id: z.number().nullable(),
  start: IsoDate,
  stop: IsoDate.nullable(),
  description: z.string().nullable(),
  server_deleted_at: IsoDate.nullable(),
});

const TimeEntry = TimeEntryRaw.omit({ server_deleted_at: true });

export const TimeEntries = z.array(TimeEntryRaw).transform((arr) =>
  arr
    .filter((e) => e.server_deleted_at === null)
    .map(({ server_deleted_at, ...rest }) => rest)
);

export type Project = z.infer<typeof Project>;
export type TimeEntry = z.infer<typeof TimeEntry>;
