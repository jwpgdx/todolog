import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';
import {
  loadSettings,
  saveSettings,
  updateSetting as updateSettingStorage,
} from '../../storage/settingsStorage';

/**
 * 설정 조회 (로컬 우선 + 서버 동기화)
 */
export const useSettings = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      // 서버에서 가져온 후 로컬에 저장
      const response = await api.get('/auth/settings');
      const settings = response.data.settings || response.data;
      await saveSettings(settings);
      console.log('✅ [useSettings] 서버에서 설정 로드:', settings);
      return settings;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // 초기 로드: 로컬 데이터 먼저 표시
  useEffect(() => {
    const loadLocalFirst = async () => {
      const cached = queryClient.getQueryData(['settings']);
      if (!cached) {
        const local = await loadSettings();
        if (local) {
          console.log('📱 [useSettings] 로컬 설정 로드:', local);
          queryClient.setQueryData(['settings'], local);
        }
      }
    };
    if (user) {
      loadLocalFirst();
    }
  }, [user, queryClient]);

  return query;
};

/**
 * 설정 업데이트
 */
export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }) => {
      // 서버 업데이트
      const response = await api.patch('/auth/settings', { [key]: value });
      return response.data.settings || response.data;
    },
    onSuccess: async (updatedSettings) => {
      // 로컬 저장소 업데이트
      await saveSettings(updatedSettings);
      console.log('✅ [useUpdateSettings] 설정 업데이트 완료:', updatedSettings);
      
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      console.error('❌ [useUpdateSettings] 설정 업데이트 실패:', error);
    },
  });
};

/**
 * 개별 설정 업데이트 (단일 키-값)
 */
export const useUpdateSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }) => {
      // 서버 업데이트
      const response = await api.patch('/auth/settings', { [key]: value });
      return response.data.settings || response.data;
    },
    onMutate: async ({ key, value }) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      
      const previousSettings = queryClient.getQueryData(['settings']);
      
      // 즉시 캐시 업데이트
      queryClient.setQueryData(['settings'], (old) => ({
        ...old,
        [key]: value,
      }));
      
      // 로컬 저장소도 즉시 업데이트
      await updateSettingStorage(key, value);
      
      return { previousSettings };
    },
    onError: (err, variables, context) => {
      // 에러 시 롤백
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
        saveSettings(context.previousSettings);
      }
      console.error('❌ [useUpdateSetting] 설정 업데이트 실패:', err);
    },
    onSuccess: async (updatedSettings) => {
      // 서버 응답으로 최종 업데이트
      await saveSettings(updatedSettings);
      queryClient.setQueryData(['settings'], updatedSettings);
      console.log('✅ [useUpdateSetting] 설정 업데이트 완료:', updatedSettings);
    },
  });
};
