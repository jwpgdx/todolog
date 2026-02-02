import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo } from '../../db/todoService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateTodo] 할일 생성 요청:', data);

      // 로컬 저장 헬퍼 함수
      const saveLocally = async () => {
        console.log('📵 [useCreateTodo] 오프라인/서버실패 - SQLite 저장');
        await ensureDatabase();
        
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tempTodo = {
          _id: tempId,
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };

        console.log('📦 [useCreateTodo] SQLite 저장 데이터:', { tempId, title: tempTodo.title, startDate: tempTodo.startDate });

        // SQLite에 저장
        await upsertTodo(tempTodo);
        console.log('✅ [useCreateTodo] SQLite 저장 완료');

        // Pending changes에 추가
        await addPendingChange({
          type: 'create',
          tempId,
          data,
        });
        console.log('✅ [useCreateTodo] Pending queue 추가 완료');

        return tempTodo;
      };

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useCreateTodo] 네트워크 상태:', { isConnected: netInfo.isConnected, type: netInfo.type });

      if (!netInfo.isConnected) {
        console.log('🚫 [useCreateTodo] 오프라인 감지 → 로컬 저장');
        return await saveLocally();
      }

      // 온라인이면 서버로 전송 시도
      console.log('🚀 [useCreateTodo] 온라인 → 서버 요청 시도');
      try {
        const res = await todoAPI.createTodo(data);
        console.log('✅ [useCreateTodo] 서버 저장 성공:', { id: res.data._id, title: res.data.title });
        
        // 서버 저장 성공 시 SQLite에도 저장
        await ensureDatabase();
        await upsertTodo(res.data);
        console.log('✅ [useCreateTodo] SQLite에도 저장 완료');
        
        return res.data;
      } catch (error) {
        console.error('⚠️ [useCreateTodo] 서버 요청 실패 → SQLite 저장으로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        return await saveLocally();
      }
    },
    onSuccess: async (data, variables) => {
      console.log('🎉 [useCreateTodo] onSuccess 호출됨:', { data, variables });

      // 날짜별 캐시 무효화 (SQLite에서 다시 조회)
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

      // 사용자 편의를 위한 마지막 사용 정보 로컬 저장
      try {
        const todoType = variables.recurrence ? 'routine' : 'todo';
        await AsyncStorage.setItem('lastUsedTodoType', todoType);

        if (variables.categoryId) {
          await AsyncStorage.setItem('lastUsedCategoryId', variables.categoryId);
        }

        console.log('✅ [useCreateTodo] 사용자 편의 정보 로컬 저장 완료:', {
          type: todoType,
          categoryId: variables.categoryId
        });
      } catch (error) {
        console.error('❌ [useCreateTodo] 로컬 저장 실패:', error);
      }
    },
    onError: (error, variables) => {
      console.error('❌ [useCreateTodo] 할일 생성 실패:', { error, variables });
    },
  });
};

