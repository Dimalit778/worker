# מדריך עבודה — Git ו-Prisma

מדריך לפרויקט **Court Guard Scheduler**.  
הפרויקט משתמש ב-**pnpm**, **Next.js**, **Prisma + PostgreSQL** (Neon). הענף הראשי הוא `master`.

---

## חלק 1: שינויים רגילים בקוד — העלאה ל-GitHub

### לפני שמתחילים

משימה אחת לענף. צור ענף חדש מ-`master` העדכני, ועדיף ב-worktree נפרד (ראה [docs/worktree-development.md](docs/worktree-development.md)):

```bash
git switch master && git pull
git switch -c feature/שם-קצר-לפיצר
```

אל תעבוד ישירות על `master`.

### שלב 1 — בדיקה מקומית

הרץ את אותן בדיקות ש-CI מריץ ב-GitHub:

```bash
pnpm ci
```

`pnpm ci` מריץ: generate → typecheck → lint → tests → build.

### שלב 2 — לראות מה השתנה

```bash
git status
git diff              # שינויים שלא נוספו ל-staging
git diff --staged     # שינויים שכבר ב-staging
```

### שלב 3 — להוסיף קבצים ל-commit

הוסף רק קבצים שקשורים למשימה:

```bash
git add src/features/schedules/my-file.tsx
git add prisma/schema.prisma prisma/migrations/
```

**אל תעלה ל-Git:** `.env`, `.env.local` (סודות), `node_modules/`, `.next/`, `.worktree-dev`.

### שלב 4 — commit

```bash
git commit -m "fix: תיקון כפילות משמרות באותו יום"
```

קידומות נפוצות: `fix:`, `feat:`, `refactor:`, `docs:`.

### שלב 5 — push ו-Pull Request

```bash
git push -u origin HEAD      # פעם ראשונה מענף חדש; אחר כך git push
gh pr create --title "כותרת ה-PR" --body "תיאור קצר"
```

אפשר גם דרך GitHub → **Compare & pull request**.  
CI ירוץ אוטומטית על ה-PR. חכה שכל הבדיקות ירוקות לפני merge.

### תרחישים נפוצים

| מצב                                     | מה לעשות                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| רוצה לעדכן commit אחרון (עדיין לא push) | `git commit --amend`                                                             |
| שכחת קובץ אחרי commit                   | `git add <file>` ואז `git commit --amend --no-edit`                              |
| master התקדם ויש conflicts              | `git fetch origin` → `git merge origin/master` (או `git rebase origin/master`)   |
| רוצה לבטל שינויים שלא commit-ת          | `git restore <file>`                                                             |
| רוצה לבטל staging                       | `git restore --staged <file>`                                                    |

---

## חלק 2: שינויים ב-Prisma (schema / DB)

### קבצים רלוונטיים

| קובץ / תיקייה          | תפקיד                                            |
| ---------------------- | ------------------------------------------------ |
| `prisma/schema.prisma` | הגדרת המודלים, enums, relations                  |
| `prisma/migrations/`   | קבצי migration — **חובה ל-commit**               |
| `prisma.config.ts`     | חיבור ל-DB (קורא `.env.local`)                   |
| `.env.local`           | `DATABASE_URL`, `DIRECT_URL` — **לא עולה ל-Git** |

### שינוי schema (הדרך הנכונה)

1. ערוך את `prisma/schema.prisma`.
2. צור migration והחל אותו על ה-DB המקומי:

```bash
pnpm db:migrate
```

Prisma יבקש שם ל-migration (למשל `add_employee_phone`), ייצור תיקייה ב-`prisma/migrations/`, יריץ אותה על ה-DB המקומי ויחדש את Prisma Client.

3. אם השינוי משפיע על נתוני seed: `pnpm db:seed`.
4. בדוק: `pnpm dev`, `pnpm typecheck`, `pnpm test:run`.
5. עשה commit ל-**schema ול-migrations יחד**:

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): הוספת שדה X למודל Y"
```

> **חשוב:** תמיד ל-commit את `schema.prisma` **וגם** את תיקיית `migrations/`.  
> בלי migration files, CI ו-production לא יידעו מה השתנה.

### אחרי pull ששינה schema (בלי שינוי schema אצלך)

```bash
pnpm install        # postinstall מריץ generate אוטומטית
pnpm db:deploy      # מריץ migrations שעדיין לא הורצו על ה-DB שלך
```

### production / staging

**לא** מריצים `db:migrate` ב-production. משתמשים ב:

```bash
pnpm db:deploy
```

`db:deploy` מריץ רק migrations קיימים ולא יוצר חדשים.  
**Vercel לא מריץ migrations.** אחרי merge של שינוי שכולל migration, הרץ `pnpm db:deploy` ידנית מול ה-DB של production (ראה [DEPLOYMENT.md](DEPLOYMENT.md)).

### `db:push` ו-`db:reset`

|                       | `db:migrate` | `db:push` |
| --------------------- | ------------ | --------- |
| יוצר קבצי migration   | כן           | לא        |
| מתאים ל-production    | כן           | לא        |
| מהיר לניסויים מקומיים | —            | כן        |

לעבודה רגילה — תמיד `pnpm db:migrate`. `db:push` רק לניסוי מהיר מקומי, ואז ליצור migration אמיתי לפני commit.

`pnpm db:reset` **מוחק את כל הנתונים** ב-DB המקומי, מריץ migrations מחדש ואז seed. השתמש רק כשאתה בטוח, **ולעולם לא ב-production**.

### משתני סביבה ל-Prisma

ב-`.env.local`:

```env
DATABASE_URL="..."   # חיבור ל-DB (לפעמים pooled — Neon)
DIRECT_URL="..."     # חיבור ישיר — נדרש ל-migrations ב-Neon
```

אם חסר `DATABASE_URL` תופיע השגיאה:

```
Error: Set DATABASE_URL (and DIRECT_URL for Neon migrations) in .env or .env.local.
```

---

## חלק 3: תרחיש מלא — קוד + Prisma + GitHub

```bash
# 1. ערוך prisma/schema.prisma
# 2. migration מקומי
pnpm db:migrate
# 3. (אופציונלי) seed
pnpm db:seed
# 4. ערוך את קוד האפליקציה (src/...)
# 5. בדיקות
pnpm ci
# 6. commit של הקבצים הרלוונטיים בלבד
git add prisma/schema.prisma prisma/migrations/ src/
git commit -m "feat: הוספת מודל X ומסך Y"
# 7. push ופתיחת PR
git push -u origin HEAD
# 8. אחרי merge — הרץ pnpm db:deploy מול production
```

---

## חלק 4: CI ב-GitHub Actions

### Secrets נדרשים

ב-GitHub: **Settings → Secrets and variables → Actions**:

| Secret            | שימוש                                             |
| ----------------- | ------------------------------------------------- |
| `DATABASE_URL`    | migrations / tests שדורשים DB                     |
| `DIRECT_URL`      | migrations ב-Neon                                 |
| `NEXTAUTH_SECRET` | build + auth                                      |
| `NEXTAUTH_URL`    | build + auth (למשל `https://your-app.vercel.app`) |

> `prisma generate` (כולל `postinstall`) **לא** דורש DB אמיתי — רק קורא את ה-schema.

### אם CI נכשל על `pnpm install`

שגיאה כמו `Set DATABASE_URL...` ב-`postinstall` — בדרך כלל `prisma.config.ts` לא מצא URL.  
אם build/test נכשלים **אחרי** install — בדוק שה-secrets למעלה מוגדרים.
