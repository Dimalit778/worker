'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { createEmployee, updateEmployee } from '@/features/employess/actions';
import { createAdminEmployee, updateAdminEmployee } from '@/features/admin/actions';
import { invalidateEmployeeDetail, invalidateEmployeesList } from '@/features/employess/hooks';
import { Button } from '@/components/ui/button';
import { InviteNotice } from './invite-notice';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Label, Input, Checkbox } from '@/components/ui';

type Props = {
  employee: EmployeeListItem | null;
  positions: PositionOption[];
  facilityId?: string;
  onClose: () => void;
};

export function EmployeeModal({ employee, positions, facilityId, onClose }: Props) {
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: async (input: {
      isEdit: boolean;
      employeeId?: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string;
      displayName: string;
      positionId: string;
      isActive: boolean;
      isReligious: boolean;
    }) => {
      if (input.isEdit && input.employeeId) {
        if (facilityId) {
          return updateAdminEmployee({
            employeeId: input.employeeId,
        firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            displayName: input.displayName,
            email: input.email,
            positionId: input.positionId,
            isActive: input.isActive,
            isReligious: input.isReligious,
          });
        }

        return updateEmployee({
          employeeId: input.employeeId,
        firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          displayName: input.displayName,
          isReligious: input.isReligious,
          positionId: input.positionId,
          isActive: input.isActive,
        });
      }

      if (facilityId) {
        return createAdminEmployee({
          facilityId,
        firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          displayName: input.displayName,
          email: input.email,
          positionId: input.positionId,
          isActive: input.isActive,
          isReligious: input.isReligious,
        });
      }

      return createEmployee({
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        positionId: input.positionId,
        displayName: input.displayName,
        isReligious: input.isReligious,
      });
    },
    onSuccess: (result, variables) => {
      if ('error' in result) {
        setError(result.error);
        return;
      }
      if (variables.isEdit && variables.employeeId) {
        invalidateEmployeeDetail(queryClient, variables.employeeId);
        onClose();
        return;
      }
      invalidateEmployeesList(queryClient, facilityId);
      const invite = result as { inviteLink?: string; emailError?: string };
      setCreatedInvite({ inviteLink: invite.inviteLink, emailError: invite.emailError });
      setCreated(true);
    },
    onError: () => setError('יצירת העובד נכשלה'),
  });
  const pending = saveMutation.isPending;
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ inviteLink?: string; emailError?: string }>({});
  const [positionId, setPositionId] = useState(employee?.position.id ?? positions[0]?.id ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [isReligious, setIsReligious] = useState(employee?.isReligious ?? false);
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
    const selectedPositionId = positionId || String(fd.get('positionId') ?? '');

    saveMutation.mutate({
      isEdit,
      employeeId: employee?.id,
      firstName,
      lastName,
      phone,
      email,
      displayName,
      positionId: selectedPositionId,
      isActive,
      isReligious,
    });
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="font-bold text-lg">מאבטח נוסף בהצלחה</h2>
          <InviteNotice inviteLink={createdInvite.inviteLink} emailError={createdInvite.emailError} />
          <Button onClick={onClose} className="w-full">
            סגור
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{isEdit ? 'עריכת עובד' : 'הוספת עובד'}</h2>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="block text-sm font-medium mb-1">שם פרטי *</Label>
            <Input name="firstName" defaultValue={employee?.firstName ?? ''} required />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">שם משפחה *</Label>
            <Input name="lastName" defaultValue={employee?.lastName ?? ''} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employee-position" className="block text-sm font-medium">
              תפקיד *
            </Label>
            <input type="hidden" name="positionId" value={positionId} required={positions.length > 0} />
            <Select value={positionId} onValueChange={setPositionId} disabled={positions.length === 0}>
              <SelectTrigger id="employee-position" className="h-auto min-h-10 w-full py-2">
                <SelectValue placeholder={positions.length === 0 ? 'אין תפקידים זמינים' : 'בחר תפקיד'} />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">טלפון</Label>
            <Input name="phone" defaultValue={employee?.phone ?? ''} />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">אימייל *</Label>
            <Input name="email" defaultValue={employee?.email ?? ''} required />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">שם תצוגה *</Label>
            <Input name="displayName" defaultValue={employee?.displayName ?? ''} required />
          </div>

          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive" className="text-sm font-medium">
                פעיל
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isReligious"
                checked={isReligious}
                onCheckedChange={(checked) => setIsReligious(checked === true)}
                className="w-4 h-4"
              />
              <Label htmlFor="isReligious" className="text-sm font-medium">
                מאבטח דתי
              </Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={pending || !positionId}
              className="flex-1 bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'שומר...' : 'שמור'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 bg-background text-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              ביטול
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
