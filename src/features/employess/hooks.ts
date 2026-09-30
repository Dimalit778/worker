'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/query-keys';
import {
  getEmployeesPageData,
  getManagerEmployeeDetail,
  getManagerEmployeeSubmissions,
} from '@/features/employess/actions';

export function invalidateEmployeesList(queryClient: ReturnType<typeof useQueryClient>, facilityId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.employees.list(facilityId) });
}

export function invalidateEmployeeDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  employeeId: string,
) {
  return Promise.all([
    invalidateEmployeesList(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.submissions(employeeId) }),
  ]);
}

export function useEmployeesList(facilityId?: string) {
  return useQuery({
    queryKey: queryKeys.employees.list(facilityId),
    queryFn: () => getEmployeesPageData(facilityId),
    enabled: facilityId !== undefined ? Boolean(facilityId) : true,
  });
}

export function useEmployeeDetail(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.employees.detail(employeeId),
    queryFn: () => getManagerEmployeeDetail(employeeId),
  });
}

export function useEmployeeSubmissions(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.employees.submissions(employeeId),
    queryFn: () => getManagerEmployeeSubmissions(employeeId),
  });
}
