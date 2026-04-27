import { cn } from '@/lib/utils';
import { AssignmentCell } from './assignment-cell';
import { assignmentKey, getDayCapacity } from '../utils';
import type { AssignmentMap, DisplayRow, WeekDay } from '../types';
import { POSITION_ORDER, POSITION_LABELS, POSITION_ROW_STYLES, SHIFT_STYLES } from '../constans';
import type { Position, ShiftType } from '@/generated/prisma/client';

type ShiftSectionProps = {
  shiftType: ShiftType;
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  guards: { id: string; name: string; position: Position }[];
  capacity: { default: {}; friday: {}; saturday: {} };
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  readonly?: boolean;
};

export function ShiftSection(props: ShiftSectionProps) {
  const { shiftType, weekDays, assignments, guards, capacity, scheduleId, periodId, courtId, readonly } = props;
  const style = SHIFT_STYLES[shiftType];
  console.log('capacity', JSON.stringify(capacity, null, 2));
  console.log('weekDays', JSON.stringify(weekDays, null, 2));
  console.log('style', JSON.stringify(style, null, 2));
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return <div>ShiftSection</div>;
  // const rows = buildRowsForWeek(capacity, sortedDays, shiftType);

  // if (rows.length === 0) {
  //   return (
  //     <div className="mb-5" dir="rtl">
  //       <div
  //         className={cn(
  //           'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm',
  //           style.header,
  //         )}
  //       >
  //         <div className="flex items-center gap-2">
  //           <span>{style.emoji}</span>
  //           <span>{style.label}</span>
  //         </div>

  //         <span className="text-[11px] font-normal opacity-80">אין תקנים למשמרת</span>
  //       </div>
  //     </div>
  //   );
  // }

  // return (
  //   <div className="mb-5" dir="rtl">
  //     <div
  //       className={cn(
  //         'flex items-center justify-between gap-2 px-3 py-2 rounded-t-lg text-white font-bold text-sm',
  //         style.header,
  //       )}
  //     >
  //       <div className="flex items-center gap-2">
  //         <span>{style.emoji}</span>
  //         <span>{style.label}</span>
  //       </div>

  //       <span className="text-[11px] font-normal opacity-80">{getShiftSummary(capacity, shiftType)}</span>
  //     </div>

  //     <div className="overflow-x-auto">
  //       <table
  //         className="w-full border-collapse bg-white border border-border border-t-0 rounded-b-lg text-xs"
  //         dir="rtl"
  //       >
  //         <thead>
  //           <tr>
  //             <th className={cn('w-8 px-1 py-1 border border-border text-white font-semibold', style.header)}>#</th>

  //             <th
  //               className={cn(
  //                 'w-24 border border-border text-white font-semibold text-center text-[11px] leading-tight',
  //                 style.header,
  //               )}
  //             >
  //               תפקיד
  //             </th>

  //             {sortedDays.map((day) => {
  //               const isWeekend = day.dayOfWeek === 5 || day.dayOfWeek === 6;

  //               return (
  //                 <th
  //                   key={day.iso}
  //                   className={cn(
  //                     'w-[68px] min-w-[68px] px-1 py-1 border border-border text-white text-center',
  //                     style.header,
  //                     isWeekend && 'brightness-110',
  //                   )}
  //                 >
  //                   <div className="font-bold text-[13px]">{day.letter}</div>
  //                   <div className="text-[10px] font-normal opacity-75">{day.label}</div>
  //                 </th>
  //               );
  //             })}
  //           </tr>
  //         </thead>

  //         <tbody>
  //           {rows.map((row, rowIndex) => (
  //             <tr
  //               key={row.key}
  //               className={cn(
  //                 POSITION_ROW_STYLES[row.position],
  //                 row.isGroupStart && rowIndex !== 0 && 'border-t-2 border-t-slate-300',
  //                 row.position === 'GUARD' && rowIndex % 2 !== 0 && 'bg-muted/20',
  //               )}
  //             >
  //               <td className="px-1 text-center border border-border text-muted-foreground font-semibold bg-muted/30">
  //                 {rowIndex + 1}
  //               </td>

  //               <td
  //                 className={cn(
  //                   'w-24 px-1 text-center border border-border bg-muted/30 text-[11px] leading-tight',
  //                   row.position !== 'GUARD' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
  //                 )}
  //               >
  //                 {row.label}
  //               </td>

  //               {sortedDays.map((day) => {
  //                 const dayCapacity = getDayCapacity(capacity, day.dayOfWeek);
  //                 const shiftCapacity = dayCapacity[shiftType];
  //                 const requiredForPosition = shiftCapacity?.[row.position] ?? 0;

  //                 const closed = row.roleSlotIndex >= requiredForPosition;

  //                 const key = assignmentKey(day.iso, shiftType);
  //                 const slotAssignments = assignments[key] ?? [];

  //                 const assignment =
  //                   slotAssignments.find((a) => a.courtShiftRoleId === row.key && a.slotIndex === row.roleSlotIndex) ??
  //                   null;

  //                 return (
  //                   <AssignmentCell
  //                     key={day.iso}
  //                     closed={closed}
  //                     assignment={assignment}
  //                     guards={guards}
  //                     scheduleId={scheduleId}
  //                     periodId={periodId}
  //                     courtId={courtId}
  //                     date={day.iso}
  //                     shiftType={shiftType}
  //                     position={row.position}
  //                     slotIndex={row.roleSlotIndex}
  //                     readonly={readonly}
  //                   />
  //                 );
  //               })}
  //             </tr>
  //           ))}
  //         </tbody>
  //       </table>
  //     </div>
  //   </div>
  // );
}
