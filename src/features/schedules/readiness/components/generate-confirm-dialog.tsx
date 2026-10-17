'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSubmissionReadiness } from '../hooks';
import { SubmissionStatusList } from './submission-status-list';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  pending: boolean;
  onConfirm: () => void;
};

/** Shown before auto-generation: submission status + the existing overwrite warning. */
export function GenerateConfirmDialog({ open, onOpenChange, scheduleId, pending, onConfirm }: Props) {
  const { data, isLoading, isError } = useSubmissionReadiness(scheduleId, open);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>ליצור שיבוץ אוטומטי?</AlertDialogTitle>
          <AlertDialogDescription>
            יצירה מחדש תחליף את כל האיושים שאינם נעולים, כולל שינויים ידניים. השיבוץ מתבסס רק על זמינות שהוגשה.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">מצב הגשות</h3>
          {isLoading && <p className="text-sm text-muted-foreground">טוען מצב הגשות...</p>}
          {isError && <p className="text-sm text-destructive">לא ניתן לטעון את מצב ההגשות.</p>}
          {data && <SubmissionStatusList readiness={data} />}
        </section>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            צור שיבוץ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
