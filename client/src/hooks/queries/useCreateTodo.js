import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo } from '../../db/todoService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';
import { generateId } from '../../utils/idGenerator';

export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateTodo] 할일 생성 요청:', data);

      await ensureDatabase();

      // UUID 생성 (클라이언트에서)
      const todoId = generateId();
      const todo = {
        _id: todoId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // SQLite에 즉시 저장
      await upsertTodo(todo);
      console.log('✅ [useCreateTodo] SQLite 저장 완료:', todoId);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useCreateTodo] 네트워크 상태:', { isConnected: netInfo.isConnected });

      if (!netInfo.isConnected) {
        console.log('📵 [useCreateTodo] 오프라인 - Pending 추가');
        await addPendingChange({
          type: 'createTodo',
          entityId: todoId,
          data: { _id: todoId, ...data },
        });
        return todo;
      }

      // 온라인: 서버 전송
      try {
        const res = await todoAPI.createTodo({ _id: todoId, ...data });
        console.log('✅ [useCreateTodo] 서버 저장 성공:', res.data._id);

        // 서버 응답으로 SQLite 업데이트
        await upsertTodo(res.data);
        return res.data;
      } catch (error) {
        console.error('⚠️ [useCreateTodo] 서버 실패 → Pending 추가:', error.message);
        await addPendingChange({
          type: 'createTodo',
          entityId: todoId,
          data: { _id: todoId, ...data },
        });
        return todo;
      }
    },
    onSuccess: async (data, variables) => {
      console.log('🎉 [useCreateTodo] onSuccess:', { id: data._id, title: data.title });

      // 날짜별 캐시 무효화
      if (data.startDate) {
        queryClient.invalidateQueries({ queryKey: ['todos', data.startDate] });
      }

      // 전체 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['todos', 'all'] });

      // 카테고리 뷰 무효화
      if (data.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
      }

      // 캘린더 캐시 무효화
      invalidateAffectedMonths(queryClient, data);

      // 사용자 편의를 위한 마지막 사용 정보 저장
      try {
        const todoType = variables.recurrence ? 'routine' : 'todo';
        await AsyncStorage.setItem('lastUsedTodoType', todoType);

        if (variables.categoryId) {
          await AsyncStorage.setItem('lastUsedCategoryId', variables.categoryId);
        }
      } catch (error) {
        console.error('❌ [useCreateTodo] 로컬 저장 실패:', error);
      }
    },
    onError: (error, variables) => {
      console.error('❌ [useCreateTodo] 할일 생성 실패:', { error, variables });
    },
  });
};
