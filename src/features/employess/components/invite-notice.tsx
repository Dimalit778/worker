'use client';

export function InviteNotice({ inviteLink, emailError }: { inviteLink?: string; emailError?: string }) {
  return (
    <div className="space-y-2 text-sm" dir="rtl">
      <p className="font-semibold">{emailError ? 'העובד נוסף, אך ההזמנה לא נשלחה' : 'ההזמנה נשלחה לאימייל של העובד'}</p>
      {emailError && <p className="text-destructive">{emailError}</p>}
      {emailError && inviteLink && (
        <>
          <p>ניתן להעביר לעובד את הקישור ידנית (תקף ל-72 שעות):</p>
          <input
            readOnly
            dir="ltr"
            value={inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border bg-background px-2 py-1 font-mono text-xs text-foreground"
          />
        </>
      )}
    </div>
  );
}
