'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';

import {
  createAdminCourt,
  createAdminEmployee,
  deleteAdminCourt,
  deleteAdminEmployee,
  updateAdminCourt,
  updateAdminEmployee,
} from '@/features/admin/actions';
import type {
  AdminActionResult,
  AdminCourtItem,
  AdminCourtsData,
  AdminEmployeeItem,
  AdminRegionItem,
  CreateAdminCourtParams,
  CreateAdminEmployeeParams,
  UpdateAdminCourtParams,
  UpdateAdminEmployeeParams,
} from '@/features/admin/types';
import { getInitialPasswordFromEmail } from '@/features/employess/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type DialogState =
  | { type: 'create-court' }
  | { type: 'edit-court'; court: AdminCourtItem }
  | { type: 'create-employee'; court: AdminCourtItem }
  | { type: 'edit-employee'; court: AdminCourtItem; employee: AdminEmployeeItem }
  | null;

type DeleteState =
  | { type: 'court'; court: AdminCourtItem }
  | { type: 'employee'; employee: AdminEmployeeItem }
  | null;

type Props = {
  data: AdminCourtsData;
};

export function AdminCourtsClient({ data }: Props) {
  const router = useRouter();
  const courts = useMemo(() => data.regions.flatMap((region) => region.courts), [data.regions]);
  const [selectedCourtId, setSelectedCourtId] = useState(courts[0]?.id ?? '');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdEmployeeEmail, setCreatedEmployeeEmail] = useState<string | null>(null);

  const selectedCourt = courts.find((court) => court.id === selectedCourtId) ?? courts[0] ?? null;
  const totalEmployees = courts.reduce((sum, court) => sum + court.employeeCount, 0);

  async function runAction(label: string, action: () => Promise<AdminActionResult>, afterSuccess?: () => void) {
    setError(null);
    setPendingLabel(label);

    try {
      const result = await action();

      if ('error' in result) {
        setError(result.error);
        return;
      }

      afterSuccess?.();
      router.refresh();
    } finally {
      setPendingLabel(null);
    }
  }

  function handleCourtSaved(input: CreateAdminCourtParams | UpdateAdminCourtParams) {
    const isEdit = 'facilityId' in input;

    return runAction(
      isEdit ? 'update-court' : 'create-court',
      () => (isEdit ? updateAdminCourt(input) : createAdminCourt(input)),
      () => setDialog(null),
    );
  }

  function handleEmployeeSaved(input: CreateAdminEmployeeParams | UpdateAdminEmployeeParams) {
    const isEdit = 'employeeId' in input;

    return runAction(
      isEdit ? 'update-employee' : 'create-employee',
      () => (isEdit ? updateAdminEmployee(input) : createAdminEmployee(input)),
      () => {
        setDialog(null);
        if (!isEdit) {
          setCreatedEmployeeEmail(input.email);
        }
      },
    );
  }

  function handleDeleteConfirmed() {
    if (!deleteState) return;

    if (deleteState.type === 'court') {
      const facilityId = deleteState.court.id;
      return runAction('delete-court', () => deleteAdminCourt(facilityId), () => {
        setDeleteState(null);
        if (selectedCourtId === facilityId) {
          setSelectedCourtId('');
        }
      });
    }

    return runAction('delete-employee', () => deleteAdminEmployee(deleteState.employee.id), () => {
      setDeleteState(null);
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">בתי משפט ועובדים</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ניהול בתי משפט לפי מחוז וצפייה בעובדים של בית המשפט הנבחר.
          </p>
        </div>
        <Button onClick={() => setDialog({ type: 'create-court' })} disabled={data.regions.length === 0}>
          <Plus />
          בית משפט
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="מחוזות" value={data.regions.length} />
        <StatCard title="בתי משפט" value={courts.length} />
        <StatCard title="עובדים" value={totalEmployees} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {createdEmployeeEmail && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          העובד נוסף בהצלחה. סיסמה ראשונית:{' '}
          <span className="font-mono font-semibold">{getInitialPasswordFromEmail(createdEmployeeEmail)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="me-2 h-7"
            onClick={() => setCreatedEmployeeEmail(null)}
          >
            סגור
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">בתי משפט לפי מחוז</CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-5">
            {data.regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">לא קיימים מחוזות במערכת.</p>
            ) : (
              data.regions.map((region) => (
                <RegionCourts
                  key={region.id}
                  region={region}
                  selectedCourtId={selectedCourt?.id ?? ''}
                  onSelectCourt={setSelectedCourtId}
                  onEditCourt={(court) => setDialog({ type: 'edit-court', court })}
                  onDeleteCourt={(court) => setDeleteState({ type: 'court', court })}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{selectedCourt ? selectedCourt.name : 'בחר בית משפט'}</CardTitle>
              {selectedCourt && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCourt.code} · {selectedCourt.employeeCount} עובדים
                </p>
              )}
            </div>
            <Button
              onClick={() => selectedCourt && setDialog({ type: 'create-employee', court: selectedCourt })}
              disabled={!selectedCourt || selectedCourt.positions.length === 0}
            >
              <Plus />
              עובד
            </Button>
          </CardHeader>
          <CardContent>
            {selectedCourt ? (
              <EmployeesTable
                court={selectedCourt}
                onEdit={(employee) => setDialog({ type: 'edit-employee', court: selectedCourt, employee })}
                onDelete={(employee) => setDeleteState({ type: 'employee', employee })}
              />
            ) : (
              <div className="flex min-h-52 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                אין בית משפט להצגה.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog?.type === 'create-court' && (
        <CourtDialog
          key="create-court"
          regions={data.regions}
          pending={pendingLabel === 'create-court'}
          onClose={() => setDialog(null)}
          onSubmit={handleCourtSaved}
        />
      )}

      {dialog?.type === 'edit-court' && (
        <CourtDialog
          key={dialog.court.id}
          court={dialog.court}
          regions={data.regions}
          pending={pendingLabel === 'update-court'}
          onClose={() => setDialog(null)}
          onSubmit={handleCourtSaved}
        />
      )}

      {dialog?.type === 'create-employee' && (
        <EmployeeDialog
          key={`create-${dialog.court.id}`}
          court={dialog.court}
          pending={pendingLabel === 'create-employee'}
          onClose={() => setDialog(null)}
          onSubmit={handleEmployeeSaved}
        />
      )}

      {dialog?.type === 'edit-employee' && (
        <EmployeeDialog
          key={dialog.employee.id}
          court={dialog.court}
          employee={dialog.employee}
          pending={pendingLabel === 'update-employee'}
          onClose={() => setDialog(null)}
          onSubmit={handleEmployeeSaved}
        />
      )}

      <DeleteDialog
        state={deleteState}
        pending={pendingLabel === 'delete-court' || pendingLabel === 'delete-employee'}
        onClose={() => setDeleteState(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function RegionCourts({
  region,
  selectedCourtId,
  onSelectCourt,
  onEditCourt,
  onDeleteCourt,
}: {
  region: AdminRegionItem;
  selectedCourtId: string;
  onSelectCourt: (facilityId: string) => void;
  onEditCourt: (court: AdminCourtItem) => void;
  onDeleteCourt: (court: AdminCourtItem) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{region.name}</h2>
        <Badge variant="secondary">{region.courts.length}</Badge>
      </div>

      {region.courts.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">אין בתי משפט במחוז.</p>
      ) : (
        <div className="space-y-2">
          {region.courts.map((court) => (
            <div
              key={court.id}
              className={cn(
                'flex items-center gap-2 rounded-md border bg-background p-2 transition-colors',
                selectedCourtId === court.id && 'border-primary bg-primary/5',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectCourt(court.id)}
                className="min-w-0 flex-1 text-start"
              >
                <span className="block truncate text-sm font-medium">{court.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" />
                  {court.employeeCount} עובדים
                </span>
              </button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEditCourt(court)}>
                <Pencil />
                <span className="sr-only">עריכת בית משפט</span>
              </Button>
              <Button type="button" variant="destructive" size="icon-sm" onClick={() => onDeleteCourt(court)}>
                <Trash2 />
                <span className="sr-only">מחיקת בית משפט</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmployeesTable({
  court,
  onEdit,
  onDelete,
}: {
  court: AdminCourtItem;
  onEdit: (employee: AdminEmployeeItem) => void;
  onDelete: (employee: AdminEmployeeItem) => void;
}) {
  if (court.positions.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        אין תפקידים לבית המשפט הזה, ולכן לא ניתן להוסיף עובדים.
      </div>
    );
  }

  if (court.employees.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        אין עובדים בבית המשפט הנבחר.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>עובד</TableHead>
          <TableHead>תפקיד</TableHead>
          <TableHead>אימייל</TableHead>
          <TableHead>טלפון</TableHead>
          <TableHead>סטטוס</TableHead>
          <TableHead className="w-24">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {court.employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>
              <div className="font-medium">{employee.displayName}</div>
              <div className="text-xs text-muted-foreground">
                {employee.firstName} {employee.lastName}
              </div>
            </TableCell>
            <TableCell>{employee.position.name}</TableCell>
            <TableCell>{employee.email || '—'}</TableCell>
            <TableCell>{employee.phone || '—'}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge variant={employee.isActive ? 'secondary' : 'outline'}>
                  {employee.isActive ? 'פעיל' : 'לא פעיל'}
                </Badge>
                {employee.isReligious && <Badge variant="outline">דתי</Badge>}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(employee)}>
                  <Pencil />
                  <span className="sr-only">עריכת עובד</span>
                </Button>
                <Button type="button" variant="destructive" size="icon-sm" onClick={() => onDelete(employee)}>
                  <Trash2 />
                  <span className="sr-only">מחיקת עובד</span>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CourtDialog({
  court,
  regions,
  pending,
  onClose,
  onSubmit,
}: {
  court?: AdminCourtItem;
  regions: AdminRegionItem[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAdminCourtParams | UpdateAdminCourtParams) => Promise<void>;
}) {
  const [districtId, setRegionId] = useState(court?.districtId ?? regions[0]?.id ?? '');
  const isEdit = !!court;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const base = {
      name: String(formData.get('name') ?? ''),
      code: String(formData.get('code') ?? ''),
      districtId,
    };

    return onSubmit(isEdit ? { ...base, facilityId: court.id } : base);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת בית משפט' : 'הוספת בית משפט'}</DialogTitle>
          <DialogDescription>קוד בית המשפט חייב להיות ייחודי במערכת.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="court-name">שם בית משפט</Label>
            <Input id="court-name" name="name" defaultValue={court?.name ?? ''} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="court-code">קוד</Label>
            <Input id="court-code" name="code" defaultValue={court?.code ?? ''} required dir="ltr" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="court-region">מחוז</Label>
            <Select value={districtId} onValueChange={setRegionId} disabled={regions.length === 0}>
              <SelectTrigger id="court-region" className="w-full">
                <SelectValue placeholder="בחר מחוז" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ביטול
            </Button>
            <Button type="submit" disabled={pending || !districtId}>
              {pending ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({
  court,
  employee,
  pending,
  onClose,
  onSubmit,
}: {
  court: AdminCourtItem;
  employee?: AdminEmployeeItem;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAdminEmployeeParams | UpdateAdminEmployeeParams) => Promise<void>;
}) {
  const [positionId, setPositionId] = useState(employee?.position.id ?? court.positions[0]?.id ?? '');
  const isEdit = !!employee;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const base = {
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      phone: String(formData.get('phone') ?? '').trim() || null,
      email: String(formData.get('email') ?? ''),
      positionId,
      isActive: formData.has('isActive'),
      isReligious: formData.has('isReligious'),
    };

    return onSubmit(isEdit ? { ...base, employeeId: employee.id } : { ...base, facilityId: court.id });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת עובד' : 'הוספת עובד'}</DialogTitle>
          <DialogDescription>{court.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee-first-name">שם פרטי</Label>
              <Input id="employee-first-name" name="firstName" defaultValue={employee?.firstName ?? ''} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-last-name">שם משפחה</Label>
              <Input id="employee-last-name" name="lastName" defaultValue={employee?.lastName ?? ''} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee-display-name">שם תצוגה</Label>
              <Input
                id="employee-display-name"
                name="displayName"
                defaultValue={employee?.displayName ?? ''}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-phone">טלפון</Label>
              <Input id="employee-phone" name="phone" defaultValue={employee?.phone ?? ''} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee-email">אימייל</Label>
              <Input id="employee-email" name="email" type="email" defaultValue={employee?.email ?? ''} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee-position">תפקיד</Label>
              <Select value={positionId} onValueChange={setPositionId} disabled={court.positions.length === 0}>
                <SelectTrigger id="employee-position" className="w-full">
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  {court.positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isActive" defaultChecked={employee?.isActive ?? true} />
              פעיל
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isReligious" defaultChecked={employee?.isReligious ?? false} />
              דתי
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ביטול
            </Button>
            <Button type="submit" disabled={pending || !positionId}>
              {pending ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  state,
  pending,
  onClose,
  onConfirm,
}: {
  state: DeleteState;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = state?.type === 'court' ? 'מחיקת בית משפט' : 'מחיקת עובד';
  const name = state?.type === 'court' ? state.court.name : state?.employee.displayName;

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.type === 'court'
              ? `מחיקת ${name} תמחק גם עובדים ונתוני שיבוץ המשויכים אליו.`
              : `האם למחוק את ${name}?`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'מוחק...' : 'מחק'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
