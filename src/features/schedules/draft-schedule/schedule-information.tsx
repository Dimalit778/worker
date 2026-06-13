import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { PeriodSummary } from '@/features/periods/types';

type ScheduleInformationProps = {
  activeCount: number;
  totalSubmissions: number;
  periods: PeriodSummary[];
};

const ScheduleInformation = ({ activeCount, totalSubmissions, periods }: ScheduleInformationProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">פעילות</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{activeCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">סה״כ הגשות</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalSubmissions}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">תקופות סה״כ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{periods.length}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleInformation;
