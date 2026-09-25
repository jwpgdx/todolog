import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSyncContext } from '../../providers/SyncProvider';
import { moveTodosToCategoryBatch } from '../../services/db/todoBulkMoveService';

export const useBulkMoveTodos = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: moveTodosToCategoryBatch,
    onSuccess: async (result) => {
      if (result?.status === 'target_invalid') {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      if (result?.status !== 'success' || (result.movedTodoIds || []).length === 0) {
        return;
      }

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => {});
        }
      } catch {
        // Local commit remains authoritative; sync retry is handled elsewhere.
      }
    },
  });
};
