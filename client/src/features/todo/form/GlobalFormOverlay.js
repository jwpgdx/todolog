import React, { useCallback } from 'react';
import { Platform, useWindowDimensions, Keyboard } from 'react-native';
import { useTodoFormStore } from '../../../store/todoFormStore';
import { useTodoFormLogic } from './useTodoFormLogic';

// Containers (플랫폼별 자동 선택)
import { QuickContainer, DetailContainer } from './containers';

// Content Components
import QuickModeContent from './components/QuickModeContent';
import DetailContent from './content/DetailContent';

/**
 * GlobalFormOverlay
 * 전역 Todo 폼 오버레이 컴포넌트 (진입점)
 * 
 * App.js 최상단에 배치되어 어디서든 폼을 띄울 수 있음.
 * Zustand Store에서 상태를 직접 구독하여 props 전달 없이 동작.
 * 
 * 플랫폼별 렌더링:
 * - Quick Mode: QuickContainer (Native: KeyboardStickyView, Web: position:fixed)
 * - Detail Mode: DetailContainer (iOS: pageSheet, Android: BottomSheet, Web: vaul/modal)
 * 
 * @see PLATFORM_ARCHITECTURE.md
 */
export default function GlobalFormOverlay() {
    const { mode, activeTodo, close, openDetail: storeOpenDetail, initialFocusTarget } = useTodoFormStore();
    const { width } = useWindowDimensions();

    // ⚠️ Hooks는 항상 조건부 return 전에 호출해야 함 (Rules of Hooks)
    const visible = mode !== 'CLOSED';

    // 폼 로직 훅 (visible 여부와 관계없이 항상 호출)
    const logic = useTodoFormLogic(activeTodo, close, visible);

    // Quick Mode 닫기
    const handleCloseQuick = useCallback(() => {
        Keyboard.dismiss();
        close();
    }, [close]);

    // Quick → Detail 전환
    const handleExpandToDetail = useCallback((target = null) => {
        Keyboard.dismiss();
        setTimeout(() => {
            storeOpenDetail(null, target);
        }, 100);
    }, [storeOpenDetail]);

    // Detail Mode 닫기 후 추가 액션 (submit 후 호출됨)
    const handleDetailSubmit = useCallback(() => {
        close();
    }, [close]);

    // 데스크탑 웹은 Quick Mode 없음 (바로 Detail)
    const isDesktopWeb = Platform.OS === 'web' && width > 768;
    const showQuickMode = mode === 'QUICK' && !isDesktopWeb;
    const showDetailMode = mode === 'DETAIL' || (mode === 'QUICK' && isDesktopWeb);

    return (
        <>
            {/* ========== Quick Mode ========== */}
            {showQuickMode && (
                <QuickContainer onClose={handleCloseQuick}>
                    <QuickModeContent
                        formState={logic.formState}
                        handleChange={logic.handleChange}
                        handleSubmit={logic.handleSubmit}
                        quickModeLabels={logic.quickModeLabels}
                        onClose={handleCloseQuick}
                        onExpandToDetail={handleExpandToDetail}
                    />
                </QuickContainer>
            )}

            {/* ========== Detail Mode ========== */}
            <DetailContainer visible={showDetailMode} onClose={close}>
                <DetailContent
                    logic={logic}
                    onClose={close}
                    onSubmit={handleDetailSubmit}
                    initialFocusTarget={initialFocusTarget}
                />
            </DetailContainer>
        </>
    );
}
