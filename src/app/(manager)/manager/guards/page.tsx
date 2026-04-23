import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { GuardsTable } from '@/features/guards/components/guards-table';
import { getGuards } from '@/features/guards/actions';

export default async function ManagerGuardsPage() {
  await requireSession(SystemRole.MANAGER);
  const guards = await getGuards();

  return (
    <div className="space-y-6">
      <GuardsTable guards={guards} />
    </div>
  );
}
