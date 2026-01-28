import { create } from 'zustand';

/**
 * TodoForm 전역 상태 스토어
 * 
 * Mode:
 * - CLOSED: 폼 닫힘
 * - QUICK: Quick Mode (키보드 연동 입력창)
 * - DETAIL: Detail Mode (전체 폼)
 * 
 * @see PLATFORM_ARCHITECTURE.md
 */
export const useTodoFormStore = create((set) => ({
    mode: 'CLOSED', // 'CLOSED' | 'QUICK' | 'DETAIL'
    activeTodo: null, // 수정 시 데이터
    initialFocusTarget: null, // 'CATEGORY' | 'DATE' 등 (Detail 진입 시 자동 열림 타겟)

    // Quick Mode 열기
    openQuick: (todo = null) => {
        console.log('📋 openQuick called! todo:', todo);
        set({
            mode: 'QUICK',
            activeTodo: todo,
            initialFocusTarget: null
        });
    },

    // Detail Mode 열기 (타겟 지정 가능)
    openDetail: (todo = null, target = null) => {
        console.log('📋 openDetail called! todo:', todo, 'target:', target);
        set((state) => ({
            mode: 'DETAIL',
            activeTodo: todo || state.activeTodo,
            initialFocusTarget: target
        }));
    },

    // 폼 닫기
    close: () => {
        console.log('📋 close called!');
        set({
            mode: 'CLOSED',
            activeTodo: null,
            initialFocusTarget: null
        });
    },

    // === 하위 호환성 (deprecated, 추후 제거) ===
    get isVisible() {
        return this.mode !== 'CLOSED';
    },
    openForm: (todo = null) => {
        console.log('⚠️ openForm is deprecated, use openQuick() instead');
        set({
            mode: 'QUICK',
            activeTodo: todo,
            initialFocusTarget: null
        });
    },
    closeForm: () => {
        console.log('⚠️ closeForm is deprecated, use close() instead');
        set({
            mode: 'CLOSED',
            activeTodo: null,
            initialFocusTarget: null
        });
    },
}));
