/**
 * Bat Yam–only demo users for local seeding (see `prisma/seed-bat-yam-full-schedule.ts`).
 * `position` maps to DB `Position.name` for court BAT_YAM: אחמ״ש / בקר / מאבטח.
 */
export type BatYamPositionKey = 'SHIFT_MANAGER' | 'BAKAR' | 'GUARD';

export type BatYamDemoUser = {
  firstName: string;
  lastName: string;
  phone: string;
  position: BatYamPositionKey;
  courtCode: 'BAT_YAM';
  email: string;
  password: string;
};

export const BAT_YAM_COURT_CODE = 'BAT_YAM' as const;

export const BAT_YAM_DEMO_PERIOD = {
  name: '12–25 באפריל 2026 (דמו שיבוץ)',
  startDate: '2026-04-12',
  endDate: '2026-04-25',
  /** Before period start — typical “submit availability by” */
  submissionDeadline: '2026-04-11T20:00:00.000Z',
} as const;

export const BAT_YAM_DEMO_USERS: BatYamDemoUser[] = [
  {
    firstName: 'דימה',
    lastName: 'ליטבינוב',
    phone: '050-0000016',
    position: 'SHIFT_MANAGER',
    courtCode: 'BAT_YAM',
    email: 'dimalit@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'דימה',
    lastName: 'גוכמן',
    phone: '050-0000017',
    position: 'SHIFT_MANAGER',
    courtCode: 'BAT_YAM',
    email: 'dimagofman@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'איב',
    lastName: 'לוי',
    phone: '050-0000018',
    position: 'SHIFT_MANAGER',
    courtCode: 'BAT_YAM',
    email: 'evelevi@gmail.com',
    password: 'eve123',
  },
  {
    firstName: 'אושר',
    lastName: 'עמר',
    phone: '050-0000019',
    position: 'BAKAR',
    courtCode: 'BAT_YAM',
    email: 'oshramar@gmail.com',
    password: 'oshr123',
  },
  {
    firstName: 'בן',
    lastName: 'הרגס',
    phone: '050-0000020',
    position: 'BAKAR',
    courtCode: 'BAT_YAM',
    email: 'benharges@gmail.com',
    password: 'ben123',
  },
  {
    firstName: 'יוחאי',
    lastName: 'אוחיון',
    phone: '050-0000021',
    position: 'BAKAR',
    courtCode: 'BAT_YAM',
    email: 'yochaiohayon@gmail.com',
    password: 'yochai123',
  },
  {
    firstName: 'אילה',
    lastName: 'גין',
    phone: '050-0000022',
    position: 'GUARD',
    courtCode: 'BAT_YAM',
    email: 'ayalagin@gmail.com',
    password: 'ayala123',
  },
  {
    firstName: 'ניק',
    lastName: 'שבדש',
    phone: '050-0000023',
    position: 'GUARD',
    courtCode: 'BAT_YAM',
    email: 'nikshabdush@gmail.com',
    password: 'nik123',
  },
  {
    firstName: 'שני',
    lastName: 'פנחס',
    phone: '050-0000024',
    position: 'GUARD',
    courtCode: 'BAT_YAM',
    email: 'shaniphenchas@gmail.com',
    password: 'shani123',
  },
];

/** DB `Position.name` per demo key (must match `ensureBatYamShiftStructure` in seed). */
export const BAT_YAM_POSITION_NAME: Record<BatYamPositionKey, string> = {
  SHIFT_MANAGER: 'אחמ״ש',
  BAKAR: 'בקר',
  GUARD: 'מאבטח',
};
