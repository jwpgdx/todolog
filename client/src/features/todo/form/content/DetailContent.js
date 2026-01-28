import React from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FormHeader from '../components/FormHeader';
import DetailedForm from '../components/DetailedForm';

/**
 * DetailContent
 * Detail Mode의 공통 컨텐츠 (FormHeader + DetailedForm)
 * 컨테이너(Modal, BottomSheet 등)는 각 플랫폼 Container에서 제공합니다.
 * 
 * @param {object} logic - useTodoFormLogic 훅에서 반환된 객체
 * @param {function} onClose - 닫기 핸들러
 * @param {function} onSubmit - 제출 후 추가 액션 (선택적)
 * @param {string} initialFocusTarget - 초기 포커스 타겟
 * @param {boolean} withScrollView - ScrollView 포함 여부 (기본: true)
 */
export default function DetailContent({
    logic,
    onClose,
    onSubmit,
    initialFocusTarget = null,
    withScrollView = true,
}) {
    const insets = useSafeAreaInsets();
    const { formState, handleChange, handleSubmit, categories } = logic;

    // 헤더 모드 계산
    const headerMode =
        logic.viewMode === 'category_create' ? 'category-add' :
            logic.viewMode === 'category_color' ? 'category-color' :
                'detail';

    // 뒤로가기 핸들러
    const handleBack = logic.viewMode !== 'default'
        ? () => logic.setViewMode(
            logic.viewMode === 'category_color' ? 'category_create' : 'default'
        )
        : undefined;

    // 저장 핸들러
    const handleSave =
        logic.viewMode === 'category_create' || logic.viewMode === 'category_color'
            ? logic.handleCategoryCreate
            : () => {
                handleSubmit();
                onSubmit?.();
            };

    // 저장 라벨
    const saveLabel =
        logic.viewMode === 'category_create' || logic.viewMode === 'category_color'
            ? '추가'
            : '저장';

    // 저장 비활성화 조건
    const saveDisabled =
        logic.isPending ||
        (logic.viewMode === 'category_create' || logic.viewMode === 'category_color'
            ? !logic.newCategoryName?.trim()
            : !formState.title.trim());

    const formContent = (
        <DetailedForm
            formState={formState}
            handleChange={handleChange}
            categories={categories}
            viewMode={logic.viewMode}
            setViewMode={logic.setViewMode}
            newCategoryName={logic.newCategoryName}
            setNewCategoryName={logic.setNewCategoryName}
            newCategoryColor={logic.newCategoryColor}
            setNewCategoryColor={logic.setNewCategoryColor}
            handleCreateCategory={logic.handleCreateCategory}
            initialFocusTarget={initialFocusTarget}
        />
    );

    return (
        <>
            <FormHeader
                mode={headerMode}
                onClose={onClose}
                onBack={handleBack}
                onSave={handleSave}
                saveLabel={saveLabel}
                saveDisabled={saveDisabled}
            />

            {withScrollView ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {formContent}
                </ScrollView>
            ) : formContent}
        </>
    );
}
