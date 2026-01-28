import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';

export const useCalendarSummary = (year, month) => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['calendarSummary', year, month],
    queryFn: async () => {
      const { data } = await api.get('/todos/calendar', {
        params: { year, month },
      });
      return data;
    },
    enabled: !!year && !!month && !!user, // 사용자가 로그인한 경우에만 실행
  });
};
