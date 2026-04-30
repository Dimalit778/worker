'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { createEmployee, updateEmployee } from '@/features/employess/actions';
import { getInitialPasswordFromEmail } from '../utils';

type Props = {
  employee: EmployeeListItem | null;
  positions: PositionOption[];
  onClose: () => void;
};

export function EmployeeModal({ employee, positions, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const isEdit = !!employee;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const firstName = String(fd.get('firstName') ?? '').trim();
    const lastName = String(fd.get('lastName') ?? '').trim();
    const phoneValue = String(fd.get('phone') ?? '').trim();
    const phone = phoneValue.length > 0 ? phoneValue : null;
    const email = String(fd.get('email') ?? '').trim();
    const displayName = String(fd.get('displayName') ?? '').trim();
    const positionId = String(fd.get('positionId') ?? '');
    const isActive = fd.has('isActive');
    const isReligious = fd.has('isReligious');

    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateEmployee({
            employeeId: employee!.id,
            firstName,
            lastName,
            phone,
            displayName,
            isReligious,
            positionId,
            isActive,
          })
        : await createEmployee({
            firstName,
            lastName,
            phone,
            email,
            positionId,
            displayName,
            isReligious,
          });

      if ('error' in result) {
        setError(result.error);
        return;
      }

      if (isEdit) {
        onClose();
      } else {
        setCreatedEmail(email);
        setCreated(true);
      }

      router.refresh();
    });
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="font-bold text-lg">מאבטח נוסף בהצלחה</h2>
          <p className="text-sm text-muted-foreground text-center">
            הסיסמה הראשונית היא
            <span className="font-mono font-semibold"> {getInitialPasswordFromEmail(createdEmail)}</span>. המאבטח יתבקש
            לשנות אותה בכניסה הראשונה.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90"
          >
            סגור
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{isEdit ? 'עריכת עובד' : 'הוספת עובד'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">שם פרטי *</label>
            <input
              name="firstName"
              defaultValue={employee?.firstName ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">שם משפחה *</label>
            <input
              name="lastName"
              defaultValue={employee?.lastName ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">תפקיד *</label>
            <select
              name="positionId"
              defaultValue={employee?.position.id ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">טלפון</label>
            <input
              name="phone"
              defaultValue={employee?.phone ?? ''}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">אימייל *</label>
            <input
              name="email"
              defaultValue={employee?.email ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">שם תצוגה *</label>
            <input
              name="displayName"
              defaultValue={employee?.displayName ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {isEdit && (
            <div className="flex justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  defaultChecked={employee?.isActive ?? false}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  פעיל
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isReligious"
                  id="isReligious"
                  defaultChecked={employee?.isReligious ?? false}
                  className="w-4 h-4"
                />
                <label htmlFor="isReligious" className="text-sm font-medium">
                  מאבטח דתי
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
