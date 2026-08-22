"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DashboardOverviewData } from "@/app/api/v1/dashboard/overview/route";

export function useDashboardOverview(days: number = 30) {
  return useQuery({
    queryKey: ["dashboard", "overview", days],
    queryFn: async () => {
      return apiClient.get<{ data: DashboardOverviewData }>(`/api/v1/dashboard/overview?days=${days}`);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
