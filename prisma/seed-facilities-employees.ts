import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { guardPrismaWorktree } from '../scripts/worktree-safety.mjs';
import { prepareEmployees, seedDirectory } from './seed';

async function main() {
  config({ path: resolve(process.cwd(), '.env.local'), quiet: true });
  config({ path: resolve(process.cwd(), '.env'), quiet: true });
  guardPrismaWorktree(process.cwd(), process.env);
  if (process.env.NODE_ENV === 'production') throw new Error('סיד דמה אינו מיועד לסביבת production.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const target = new URL(connectionString);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const employees = prepareEmployees();
    for (const employee of employees.filter((e) => e.email !== e.originalEmail)) {
      console.log(`אימייל דמה ייחודי: ${employee.originalEmail} → ${employee.email} (${employee.facilityCode})`);
    }
    console.log(
      `מחיקה מלאה של נתוני האפליקציה במסד ${target.hostname}${target.pathname}. ייטענו מתקנים, תקנים ועובדים בלבד, בלי שיבוץ.`,
    );
    if ((await prompt.question('להמשך הקלד DELETE: ')).trim() !== 'DELETE') {
      console.log('בוטל. לא בוצע שינוי במסד.');
      return;
    }
  } finally {
    prompt.close();
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await seedDirectory(prisma);
    console.log('הסיד הושלם. נטענו מחוז תל אביב, מתקני בת ים ושוקן, תקנים ועובדים. לא נוצר שיבוץ.');
    console.table(
      result.employees
        .filter((e) => e.canEditSchedule)
        .map((e) => ({ facility: e.facilityCode, email: e.email, password: e.password })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'הסיד נכשל.');
    process.exitCode = 1;
  });
}
