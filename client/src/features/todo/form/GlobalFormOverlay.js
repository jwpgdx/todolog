import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, useWindowDimensions, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useTodoFormStore } from '../../../store/todoFormStore';
import { useTodoFormV2Store } from '../../../store/todoFormV2Store';
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
    const { mode, activeTodo, close, initialFocusTarget } = useTodoFormStore();
    const setDetailV2Draft = useTodoFormV2Store((state) => state.setDraft);
    const { width } = useWindowDimensions();
    const isIOS = Platform.OS === 'ios';
    const hasRedirectedDesktopQuickRef = useRef(false);

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
        setDetailV2Draft({
            activeTodo,
            formState: logic.formState,
            focusTarget: target,
        });
        Keyboard.dismiss();
        close();
        setTimeout(() => {
            router.push({
                pathname: '/todo-form/v2',
                params: {
                    handoff: 'quick',
                    focusTarget: target || '',
                },
            });
        }, 100);
    }, [activeTodo, close, logic.formState, setDetailV2Draft]);

    // Detail Mode 닫기 후 추가 액션 (submit 후 호출됨)
    const handleDetailSubmit = useCallback(() => {
        close();
    }, [close]);

    // 데스크탑 웹은 Quick Mode 없음 (바로 Detail)
    const isDesktopWeb = Platform.OS === 'web' && width > 768;
    const showQuickMode = mode === 'QUICK' && !isDesktopWeb;
    const showDetailMode = mode === 'DETAIL';

    useEffect(() => {
        if (!(mode === 'QUICK' && isDesktopWeb)) {
            hasRedirectedDesktopQuickRef.current = false;
            return;
        }

        if (hasRedirectedDesktopQuickRef.current) {
            return;
        }

        hasRedirectedDesktopQuickRef.current = true;
        close();
        router.push('/todo-form/v2');
    }, [close, isDesktopWeb, mode]);

    return (
        <>
            {/* ========== Quick Mode ========== */}
            {isIOS ? (
                <>
                    {/* iOS: InputAccessoryView host는 상시 마운트, 열릴 때만 focus */}
                    <QuickModeContent
                        visible={showQuickMode}
                        formState={logic.formState}
                        handleChange={logic.handleChange}
                        handleSubmit={logic.handleSubmit}
                        quickModeLabels={logic.quickModeLabels}
                        onClose={handleCloseQuick}
                        onExpandToDetail={handleExpandToDetail}
                    />

                    {/* iOS: backdrop만 QUICK일 때 표시 */}
                    {showQuickMode && <QuickContainer onClose={handleCloseQuick} />}
                </>
            ) : (
                showQuickMode && (
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
                )
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
