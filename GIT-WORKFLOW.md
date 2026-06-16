# מדריך עבודה — Git ו-Prisma

מדריך מפורט לפרויקט **Court Guard Scheduler**.  
הפרויקט משתמש ב-**pnpm**, **Next.js**, **Prisma + PostgreSQL** (Neon).

---

## חלק 1: שינויים רגילים בקוד — העלאה ל-GitHub

### לפני שמתחילים

ודא שאתה על הענף הנכון:

```bash
git branch
```

אם אתה עובד על פיצ'ר חדש, צור ענף:

```bash
git checkout -b feature/שם-קצר-לפיצר
```

---

### שלב 1 — בדיקה מקומית (מומלץ לפני commit)

הרץ את אותן בדיקות ש-CI מריץ ב-GitHub:

```bash
pnpm install          # רק אם הוספת/שינית תלויות
pnpm db:generate      # רק אם שינית Prisma (ראה חלק 2)
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

או בפקודה אחת:

```bash
pnpm ci
```

> `pnpm ci` מריץ: generate → typecheck → lint → tests → build.

---

### שלב 2 — לראות מה השתנה

```bash
git status
git diff              # שינויים שלא נוספו ל-staging
git diff --staged     # שינויים שכבר ב-staging
```

---

### שלב 3 — להוסיף קבצים ל-commit

להוסיף קבצים ספציפיים:

```bash
git add src/features/schedules/my-file.tsx
git add prisma/schema.prisma prisma/migrations/
```

או להוסיף הכל (זהירות — ודא שאין קבצים שלא רוצים לעלות):

```bash
git add .
```

**אל תעלה ל-Git:**

- `.env`, `.env.local` — סודות וסיסמאות
- `node_modules/`, `.next/` — תיקיות build (בדרך כלל ב-.gitignore)

---

### שלב 4 — commit

```bash
git commit -m "תיאור קצר וברור של השינוי"
```

דוגמאות להודעות טובות:

- `fix: תיקון כפילות משמרות באותו יום`
- `feat: הוספת תצוגת סידור למנהל`
- `refactor: פיצול לוגיקת fairness לקובץ נפרד`

---

### שלב 5 — push ל-GitHub

**פעם ראשונה** מענף חדש:

```bash
git push -u origin HEAD
```

**בפעמים הבאות** מאותו ענף:

```bash
git push
```

---

### שלב 6 — Pull Request (מומלץ)

אם עבדת על ענף נפרד מ-`main`:

1. לך ל-GitHub → ה-repo → **Compare & pull request**
2. או מהטרמינל (אם מותקן `gh`):

```bash
gh pr create --title "כותרת ה-PR" --body "תיאור קצר"
```

CI ירוץ אוטומטית על ה-PR. חכה שכל הבדיקות ירוקות לפני merge.

---

### תרחישים נפוצים

| מצב                                     | מה לעשות                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| רוצה לעדכן commit אחרון (עדיין לא push) | `git commit --amend`                                                       |
| שכחת קובץ אחרי commit                   | `git add <file>` ואז `git commit --amend --no-edit`                        |
| main התקדם ויש conflicts                | `git fetch origin` → `git merge origin/main` (או `git rebase origin/main`) |
| רוצה לבטל שינויים שלא commit-ת          | `git restore <file>`                                                       |
| רוצה לבטל staging                       | `git restore --staged <file>`                                              |

---

## חלק 2: שינויים ב-Prisma (schema / DB)

### קבצים רלוונטיים

| קובץ / תיקייה          | תפקיד                                            |
| ---------------------- | ------------------------------------------------ |
| `prisma/schema.prisma` | הגדרת המודלים, enums, relations                  |
| `prisma/migrations/`   | קבצי migration — **חובה ל-commit**               |
| `prisma.config.ts`     | חיבור ל-DB (קורא `.env.local`)                   |
| `.env.local`           | `DATABASE_URL`, `DIRECT_URL` — **לא עולה ל-Git** |

---

### סדר פקודות — שינוי schema (הדרך הנכונה)

#### 1. ערוך את `prisma/schema.prisma`

הוסף/שנה/מחק מודלים, שדות, relations וכו'.

#### 2. צור migration והחל על DB המקומי

```bash
pnpm db:migrate
```

Prisma יבקש **שם ל-migration** (למשל: `add_employee_phone`).

מה קורה:

- נוצרת תיקייה חדשה ב-`prisma/migrations/`
- ה-migration מורץ על DB המקומי
- Prisma Client נוצר מחדש אוטומטית

#### 3. (אופציונלי) עדכן seed

אם שינית מודלים שמשפיעים על נתוני seed:

```bash
pnpm db:seed
```

#### 4. בדוק שהאפליקציה עובדת

```bash
pnpm dev
```

ובדיקות:

```bash
pnpm typecheck
pnpm test:run
```

#### 5. commit — **schema + migrations יחד**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): הוספת שדה X למודל Y"
git push
```

> **חשוב:** תמיד ל-commit את `schema.prisma` **וגם** את תיקיית `migrations/`.  
> בלי migration files, CI ו-production לא יידעו מה השתנה.

---

### סדר פקודות — רק generate (בלי שינוי schema)

אם משכת שינויים מ-GitHub שכבר כוללים migrations:

```bash
pnpm install        # postinstall מריץ generate אוטומטית
pnpm db:deploy      # מריץ migrations שלא הורצו עדיין על DB שלך
```

או במפורש:

```bash
pnpm db:generate
pnpm db:deploy
```

---

### סדר פקודות — production / staging

**לא** מריצים `db:migrate` ב-production.  
שם משתמשים ב:

```bash
pnpm db:deploy
```

`db:deploy` מריץ רק migrations קיימים — בלי ליצור חדשים.  
בדרך כלל Vercel / CI / deploy script מריץ את זה אוטומטית.

---

### `db:push` — מתי כן ומתי לא

```bash
pnpm db:push
```

|                       | `db:migrate` | `db:push` |
| --------------------- | ------------ | --------- |
| יוצר קבצי migration   | ✅ כן        | ❌ לא     |
| מתאים ל-production    | ✅ כן        | ❌ לא     |
| מהיר לניסויים מקומיים | —            | ✅ כן     |

**המלצה:** לעבודה רגילה — תמיד `pnpm db:migrate`.  
`db:push` רק לניסוי מהיר מקומי, ואז ליצור migration אמיתי לפני commit.

---

### `db:reset` — זהירות!

```bash
pnpm db:reset
```

**מוחק את כל הנתונים** ב-DB המקומי, מריץ migrations מחדש, ואז seed.  
השתמש רק כשאתה בטוח. **אל תריץ ב-production.**

---

### משתני סביבה ל-Prisma

ב-`.env.local`:

```env
DATABASE_URL="..."   # חיבור ל-DB (לפעמים pooled — Neon)
DIRECT_URL="..."     # חיבור ישיר — נדרש ל-migrations ב-Neon
```

`prisma.config.ts` קורא את `.env.local` (ואז `.env`).

אם חסר `DATABASE_URL`:

```
Error: Set DATABASE_URL (and DIRECT_URL for Neon migrations) in .env or .env.local.
```

---

## חלק 3: תרחיש מלא — שינוי קוד + Prisma + GitHub

```bash
# 1. ערוך schema
#    (עריכה ידנית של prisma/schema.prisma)

# 2. migration מקומי
pnpm db:migrate

# 3. (אופציונלי) seed
pnpm db:seed

# 4. ערוך קוד האפליקציה
#    (עריכה ידנית של קבצי src/...)

# 5. בדיקות
pnpm ci

# 6. commit הכל
git add prisma/schema.prisma prisma/migrations/ src/
git commit -m "feat: הוספת מודל X ומסך Y"

# 7. push
git push -u origin HEAD   # או git push

# 8. פתח PR ב-GitHub
```

---

## סיכום מהיר

### שינוי קוד בלבד

```bash
pnpm ci
git add .
git commit -m "..."
git push
```

### שינוי Prisma

```bash
# ערוך prisma/schema.prisma
pnpm db:migrate
pnpm db:seed          # אם צריך
pnpm ci
git add prisma/schema.prisma prisma/migrations/
git commit -m "..."
git push
```

### אחרי pull מ-GitHub (מישהו אחר שינה schema)

```bash
git pull
pnpm install
pnpm db:deploy
pnpm dev
```

---

## חלק 4: CI ב-GitHub Actions

### Secrets נדרשים

ב-GitHub: **Settings → Secrets and variables → Actions** — הוסף:

| Secret            | שימוש                                             |
| ----------------- | ------------------------------------------------- |
| `DATABASE_URL`    | migrations / tests שדורשים DB                     |
| `DIRECT_URL`      | migrations ב-Neon                                 |
| `NEXTAUTH_SECRET` | build + auth                                      |
| `NEXTAUTH_URL`    | build + auth (למשל `https://your-app.vercel.app`) |

> `prisma generate` (כולל `postinstall`) **לא** דורש DB אמיתי — רק קורא את ה-schema.

### אם CI נכשל על `pnpm install`

שגיאה כמו `Set DATABASE_URL...` ב-`postinstall` — בדרך כלל `prisma.config.ts` לא מצא URL.  
אחרי התיקון בפרויקט, `generate` עובד גם בלי secrets.  
אם build/test נכשלים **אחרי** install — בדוק שה-secrets למעלה מוגדרים.
