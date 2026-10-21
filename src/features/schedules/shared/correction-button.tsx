import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CorrectionButton() {
  return <Button asChild><Link href="/manager/schedule">עריכת השיבוץ הנוכחי</Link></Button>;
}
