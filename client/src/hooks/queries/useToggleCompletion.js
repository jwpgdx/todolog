import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { completionAPI } from '../../api/todos';
import { toggleCompletionLocally } from '../../storage/completionStorage';
import { addPendingChange } from '../../storage/pendingChangesStorage';

/**
 * Completion 토글 훅 (Optimistic Update + Offline-First)
 * 
 * 흐름:
 * 1. 로컬 즉시 토글 (toggleCompletionLocally)
 * 2. 캐시 직접 업데이트 (setQueryData)
 * 3. 네트워크 확인
 *    - 온라인: 서버 요청 (백그라운드)
 *    - 오프라인: Pending Queue 추가
 * 4. 실패 시: Pending Queue 추가
 */
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, date, currentCompleted }) => {
      console.log('🔄 [useToggleCompletion] 시작:', { todoId, date, currentCompleted });
      
      // 1. 로컬 즉시 토글 (Optimistic Update)
      const newState = await toggleCompletionLocally(todoId, date);
      console.log('✅ [useToggleCompletion] 로컬 토글 완료:', newState);
      
      // 2. 네트워크 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useToggleCompletion] 네트워크 상태:', netInfo.isConnected);
      
      if (!netInfo.isConnected) {
        // 오프라인: Pending Queue 추가
        console.log('📵 [useToggleCompletion] 오프라인 - Pending Queue 추가');
        await addPendingChange({
          type: newState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
          timestamp: new Date().toISOString(),
        });
        return { completed: newState, offline: true };
      }
      
      // 3. 온라인: 서버 요청 (백그라운드)
      try {
        console.log('🌐 [useToggleCompletion] 서버 요청 시작');
        const res = await completionAPI.toggleCompletion(todoId, date);
        console.log('✅ [useToggleCompletion] 서버 요청 성공:', res.data);
        return res.data;
      } catch (error) {
        // 서버 실패: Pending Queue 추가
        console.error('❌ [useToggleCompletion] 서버 요청 실패:', error.message);
        await addPendingChange({
          type: newState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
          timestamp: new Date().toISOString(),
        });
        return { completed: newState, offline: true };
      }
    },
    onSuccess: (data, variables) => {
      console.log('✅ [useToggleCompletion] onSuccess:', data);
      
      // 1. Completion 캐시 업데이트
      queryClient.setQueryData(['completions'], (oldCompletions) => {
        if (!oldCompletions) return oldCompletions;
        
        const key = `${variables.todoId}_${variables.date || 'null'}`;
        const newCompletions = { ...oldCompletions };
        
        if (data.completed) {
          // 완료: Completion 추가
          newCompletions[key] = {
            todoId: variables.todoId,
            date: variables.date || null,
            completedAt: new Date().toISOString(),
          };
        } else {
          // 취소: Completion 삭제
          delete newCompletions[key];
        }
        
        return newCompletions;
      });
      
      // 2. 'all' 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (oldData) => {
        if (!oldData) return oldData;
        
        return oldData.map(todo => {
          if (todo._id === variables.todoId) {
            return { ...todo, completed: data.completed };
          }
          return todo;
        });
      });
      
      // 3. 날짜별 캐시도 직접 업데이트 (무효화 대신)
      if (variables.date) {
        queryClient.setQueryData(['todos', variables.date], (oldData) => {
          if (!oldData) return oldData;
          
          return oldData.map(todo => {
            if (todo._id === variables.todoId) {
              return { ...todo, completed: data.completed };
            }
            return todo;
          });
        });
      }
      
      // 4. 캘린더 요약 무효화 (오프라인 시 실패해도 괜찮음)
      queryClient.invalidateQueries({ 
        queryKey: ['calendarSummary'],
        refetchType: 'none' // 재조회 안 함
      });
    },
    onError: (error, variables) => {
      console.error('❌ [useToggleCompletion] onError:', error);
      // 에러 발생 시 로컬 상태는 이미 변경됨 (Optimistic)
      // Pending Queue에 추가되어 있으므로 나중에 재시도됨
    }
  });
};
