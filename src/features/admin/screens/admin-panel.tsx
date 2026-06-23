import { AdminCourtsData } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

export function AdminPanel({ data }: { data: AdminCourtsData }) {
  const courts = data.regions.flatMap((region) => region.courts);
  const totalEmployees = courts.reduce((sum, court) => sum + court.employeeCount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard title="מחוזות" value={data.regions.length} />
      <StatCard title="בתי משפט" value={courts.length} />
      <StatCard title="עובדים" value={totalEmployees} />
    </div>
  );
}
