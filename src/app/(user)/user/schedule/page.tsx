import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';

export default async function UserSchedulePage() {
  await requireSession(SystemRole.EMPLOYEE);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">schedule</h1>
    </div>
  );
}
