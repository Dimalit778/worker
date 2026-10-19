import type { StaffPositionCount } from '../queries';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
] as const;

const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 80;

function polarToCartesian(radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleInRadians),
    y: CENTER + radius * Math.sin(angleInRadians),
  };
}

function describePieSegment(startAngle: number, endAngle: number) {
  const start = polarToCartesian(RADIUS, endAngle);
  const end = polarToCartesian(RADIUS, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

type StaffPositionChartProps = {
  byPosition: StaffPositionCount[];
  totalActive: number;
};

export function StaffPositionChart({ byPosition, totalActive }: StaffPositionChartProps) {
  const segments = byPosition
    .map((item, index) => ({ ...item, color: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }))
    .filter((item) => item.count > 0);

  let currentAngle = 0;

  return (
    <div className="mx-auto aspect-square w-full max-w-36">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full"
        role="img"
        aria-label="תרשים עוגה של כוח אדם לפי תפקיד"
      >
        {totalActive === 0 ? (
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="var(--muted)" />
        ) : (
          segments.map((segment) => {
            const sweep = (segment.count / totalActive) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sweep;
            currentAngle = endAngle;

            return (
              <path
                key={segment.name}
                d={describePieSegment(startAngle, endAngle)}
                fill={segment.color}
                className="transition-opacity hover:opacity-90"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export { CHART_COLORS };
