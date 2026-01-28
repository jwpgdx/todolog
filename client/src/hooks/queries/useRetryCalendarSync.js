// ===== GOOGLE AUTH TEMPORARILY DISABLED =====
// TODO: Re-enable when implementing Google Auth feature

/*
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoAPI } from '../../api/todos';
import Toast from 'react-native-toast-message';

export const useRetryCalendarSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: todoAPI.retryCalendarSync,
    onSuccess: (data) => {
      // 모든 todo 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['allTodos'] });
      
      Toast.show({
        type: 'success',
        text1: '캘린더 동기화 성공',
        text2: '구글 캘린더에 일정이 추가되었습니다',
      });
    },
    onError: (error) => {
      console.error('Calendar sync retry failed:', error);
      Toast.show({
        type: 'error',
        text1: '캘린더 동기화 실패',
        text2: error.response?.data?.message || '다시 시도해주세요',
      });
    },
  });
};

export const useRetryAllFailedSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: todoAPI.retryAllFailedSync,
    onSuccess: (data) => {
      // 모든 todo 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['allTodos'] });
      
      const { successCount, failCount, total } = data.data;
      Toast.show({
        type: successCount > 0 ? 'success' : 'error',
        text1: '일괄 재시도 완료',
        text2: `성공: ${successCount}개, 실패: ${failCount}개 (총 ${total}개)`,
      });
    },
    onError: (error) => {
      console.error('Batch calendar sync retry failed:', error);
      Toast.show({
        type: 'error',
        text1: '일괄 재시도 실패',
        text2: error.response?.data?.message || '다시 시도해주세요',
      });
    },
  });
};
*/

import Toast from 'react-native-toast-message';

// Mock implementations when Google Auth is disabled
export const useRetryCalendarSync = () => {
  return {
    mutate: () => {
      Toast.show({
        type: 'info',
        text1: '구글 캘린더 연동 기능 준비 중',
        text2: '추후 업데이트에서 제공될 예정입니다',
      });
    },
    isPending: false,
  };
};

export const useRetryAllFailedSync = () => {
  return {
    mutate: () => {
      Toast.show({
        type: 'info',
        text1: '구글 캘린더 연동 기능 준비 중',
        text2: '추후 업데이트에서 제공될 예정입니다',
      });
    },
    isPending: false,
  };
};