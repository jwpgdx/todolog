import { useActionSheet } from '@expo/react-native-action-sheet';

/**
 * 카테고리 관리 액션 시트 훅
 * @param {Object} options
 * @param {Function} options.onEdit - 수정 액션 콜백 (category) => void
 * @param {Function} options.onDelete - 삭제 액션 콜백 (categoryId) => void
 */
export const useCategoryActionSheet = ({ onEdit, onDelete }) => {
    const { showActionSheetWithOptions } = useActionSheet();

    const showOptions = (category) => {
        // Options array
        const options = ['수정', '삭제', '취소'];

        const destructiveButtonIndex = options.indexOf('삭제');
        const cancelButtonIndex = options.indexOf('취소');

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                destructiveButtonIndex,
                title: category.name, // 제목으로 카테고리 이름 표시
            },
            (selectedIndex) => {
                const selectedOption = options[selectedIndex];

                switch (selectedOption) {
                    case '수정':
                        onEdit(category);
                        break;
                    case '삭제':
                        onDelete(category._id);
                        break;
                    case '취소':
                        break;
                }
            }
        );
    };

    return { showOptions };
};
