import { Position, SystemRole } from '../src/generated/prisma/client';
export type CourtSeed = {
  name: string;
  code: string;
  regionCode: string;
};
export type EmployeeSeed = {
  firstName: string;
  lastName: string;
  phone?: string;
  position: Position;
  courtCode: string;
  email: string;
  password: string;
  systemRole?: SystemRole;
  mustChangePassword?: boolean;
};
export const REGIONS = [
  { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  { name: 'מחוז תל אביב', code: 'TEL_AVIV' },
  { name: 'מחוז חיפה', code: 'HAIFA' },
  { name: 'מחוז מרכז', code: 'CENTER' },
];
const COURTS: CourtSeed[] = [
  { name: 'בית משפט מחוזי ירושלים', code: 'JERUSALEM', regionCode: 'JERUSALEM' },
  { name: 'בית משפט מחוזי תל אביב (ויצמן)', code: 'VAITZMAN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שוקן', code: 'SHOKEN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט ראשון לציון', code: 'RISHON', regionCode: 'CENTER' },
];
const EMPLOYEES: EmployeeSeed[] = [
  // ירושלים
  {
    firstName: 'אבי',
    lastName: 'כהן',
    phone: '050-0000001',
    position: Position.FACILITY_OFFICER,
    courtCode: 'JERUSALEM',
    email: 'avichoen@gmail.com',
    password: 'avi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דניאל',
    lastName: 'לוי',
    phone: '050-0000002',
    position: Position.SHIFT_MANAGER,
    courtCode: 'JERUSALEM',
    email: 'daniellevy@gmail.com',
    password: 'daniel123',
  },
  {
    firstName: 'רועי',
    lastName: 'מזרחי',
    phone: '050-0000003',
    position: Position.BAKAR,
    courtCode: 'JERUSALEM',
    email: 'roimizrahi@gmail.com',
    password: 'roi123',
  },
  {
    firstName: 'נועם',
    lastName: 'ביטון',
    phone: '050-0000004',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'noambiton@gmail.com',
    password: 'noam123',
  },
  {
    firstName: 'שחר',
    lastName: 'אוחנה',
    phone: '050-0000005',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'shaharohana@gmail.com',
    password: 'shahar123',
  },

  // ויצמן
  {
    firstName: 'אלרואי',
    lastName: 'מגידיש',
    phone: '050-0000006',
    position: Position.FACILITY_OFFICER,
    courtCode: 'VAITZMAN',
    email: 'elroimegidish@gmail.com',
    password: 'elroi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'שוהם',
    lastName: 'מלכה',
    phone: '050-0000007',
    position: Position.SHIFT_MANAGER,
    courtCode: 'VAITZMAN',
    email: 'shohammalka@gmail.com',
    password: 'shoham123',
  },
  {
    firstName: 'איתי',
    lastName: 'שלום',
    phone: '050-0000008',
    position: Position.BAKAR,
    courtCode: 'VAITZMAN',
    email: 'itaishalom@gmail.com',
    password: 'itai123',
  },
  {
    firstName: 'אתי',
    lastName: 'לולה',
    phone: '050-0000009',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'etilola@gmail.com',
    password: 'etil123',
  },
  {
    firstName: 'בן',
    lastName: 'חיים',
    phone: '050-0000010',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'benhaim@gmail.com',
    password: 'ben123',
  },

  // שוקן
  {
    firstName: 'אסף',
    lastName: 'גולן',
    phone: '050-0000011',
    position: Position.FACILITY_OFFICER,
    courtCode: 'SHOKEN',
    email: 'asafgolan@gmail.com',
    password: 'asaf123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'אופיר',
    lastName: 'דוד',
    phone: '050-0000012',
    position: Position.SHIFT_MANAGER,
    courtCode: 'SHOKEN',
    email: 'ofirdavid@gmail.com',
    password: 'ofir123',
  },
  {
    firstName: 'ליאור',
    lastName: 'סבן',
    phone: '050-0000013',
    position: Position.BAKAR,
    courtCode: 'SHOKEN',
    email: 'liorsaban@gmail.com',
    password: 'lior123',
  },
  {
    firstName: 'עידן',
    lastName: 'אמסלם',
    phone: '050-0000014',
    position: Position.GUARD,
    courtCode: 'SHOKEN',
    email: 'idanamsalem@gmail.com',
    password: 'idan123',
  },

  // בת ים
  {
    firstName: 'תומר',
    lastName: 'לוי',
    phone: '050-0000015',
    position: Position.FACILITY_OFFICER,
    courtCode: 'BAT_YAM',
    email: 'tomerlevi@gmail.com',
    password: 'tomer123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דימה',
    lastName: 'ליטבינוב',
    phone: '050-0000016',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimalit@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'דימה',
    lastName: 'גוכמן',
    phone: '050-0000017',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimagofman@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'איב',
    lastName: 'לוי',
    phone: '050-0000018',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'evelevi@gmail.com',
    password: 'eve123',
  },
  {
    firstName: 'אושר',
    lastName: 'עמר',
    phone: '050-0000019',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'oshramar@gmail.com',
    password: 'oshr123',
  },
  {
    firstName: 'בן',
    lastName: 'הרגס',
    phone: '050-0000020',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'benharges@gmail.com',
    password: 'ben123',
  },
  {
    firstName: 'יוחאי',
    lastName: 'אוחיון',
    phone: '050-0000021',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'yochaiohayon@gmail.com',
    password: 'yochai123',
  },
  {
    firstName: 'אילה',
    lastName: 'גין',
    phone: '050-0000022',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'ayalagin@gmail.com',
    password: 'ayala123',
  },
  {
    firstName: 'ניק',
    lastName: 'שבדש',
    phone: '050-0000023',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'nikshabdush@gmail.com',
    password: 'nik123',
  },
  {
    firstName: 'שני',
    lastName: 'פנחס',
    phone: '050-0000024',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'shaniphenchas@gmail.com',
    password: 'shani123',
  },
];
