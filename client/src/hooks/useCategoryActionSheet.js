import { useActionSheet } from '@expo/react-native-action-sheet';

/**
 * 카테고리 관리 액션 시트 훅
 * @param {Object} options
 * @param {Function} options.onEdit - 수정 액션 콜백 (category) => void
 * @param {Function} options.onDelete - 삭제 액션 콜백 (category) => void
 */
export const useCategoryActionSheet = ({ onEdit, onDelete, onSetDefault }) => {
    const { showActionSheetWithOptions } = useActionSheet();

    const showOptions = (category) => {
        const isDefault = category.isDefault;

        // Options array
        let options = ['수정'];
        if (!isDefault) {
            options.push('기본 카테고리로 설정');
        }
        options.push('삭제');
        options.push('취소');

        const destructiveButtonIndex = options.indexOf('삭제');
        const cancelButtonIndex = options.indexOf('취소');

        // 기본 카테고리일 경우 삭제 버튼 비활성화 (인덱스 지정)
        // If Default: Options are ['수정', '삭제', '취소'] -> Delete is 1
        // If Not Default: Options are ['수정', '기본...', '삭제', '취소'] -> Delete is 2
        // Actually, if it IS default, we disable delete.
        // Wait, logic in previous code was: disabledButtonIndices = isDefault ? [1] : [].
        // Now indices change dynamically.

        const disabledButtonIndices = isDefault ? [destructiveButtonIndex] : [];

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                destructiveButtonIndex,
                disabledButtonIndices, // iOS에서 비활성화된 버튼을 회색으로 표시
                title: category.name, // 제목으로 카테고리 이름 표시
                message: isDefault ? '기본 카테고리는 삭제할 수 없습니다.' : undefined, // 기본 카테고리일 때 메시지 표시
            },
            (selectedIndex) => {
                const selectedOption = options[selectedIndex];

                switch (selectedOption) {
                    case '수정':
                        onEdit(category);
                        break;
                    case '기본 카테고리로 설정':
                        onSetDefault(category);
                        break;
                    case '삭제':
                        if (!isDefault) {
                            onDelete(category._id, category.isDefault);
                        }
                        break;
                    case '취소':
                        break;
                }
            }
        );
    };

    return { showOptions };
};
