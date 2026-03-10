import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { InputAccessoryView, Keyboard, StyleSheet, TextInput, View } from 'react-native';
import QuickInput from './QuickInput';

/**
 * iOS QuickModeContent
 * - 키보드 위 "순정" Bar: InputAccessoryView 사용
 * - 실제 입력은 화면 밖(host) TextInput이 담당 (안정성 우선)
 *
 * NOTE:
 * InputAccessoryView는 "포커스된 TextInput"의 accessory로만 뜨기 때문에,
 * Bar를 띄우기 위한 host TextInput이 필요합니다.
 */
export default function QuickModeContent({
  visible = false,
  formState,
  handleChange,
  handleSubmit,
  quickModeLabels,
  onClose,
  onExpandToDetail,
}) {
  const accessoryId = useMemo(() => 'todo-quick-input-accessory', []);
  const hostInputRef = useRef(null);
  const suppressCloseOnKeyboardHideRef = useRef(false);

  const suppressCloseOnKeyboardHideOnce = useCallback(() => {
    suppressCloseOnKeyboardHideRef.current = true;
    setTimeout(() => {
      suppressCloseOnKeyboardHideRef.current = false;
    }, 400);
  }, []);

  const submitQuick = useCallback(() => {
    handleSubmit?.({ quickMode: true });
  }, [handleSubmit]);

  const requestFocus = useCallback(() => {
    hostInputRef.current?.focus?.();
  }, []);

  const expandToDetail = useCallback(
    (target = null) => {
      suppressCloseOnKeyboardHideOnce();
      onExpandToDetail?.(target);
    },
    [onExpandToDetail, suppressCloseOnKeyboardHideOnce]
  );

  // Quick open 시 키보드 + accessory bar 띄우기
  useEffect(() => {
    if (!visible) {
      hostInputRef.current?.blur?.();
      return;
    }

    const t = setTimeout(() => {
      hostInputRef.current?.focus?.();
    }, 0);

    return () => clearTimeout(t);
  }, [visible]);

  // 키보드 제스처 dismiss 시(내려버리기) Quick Mode도 같이 닫히게 처리
  // 단, Quick→Detail 전환 과정에서 dismiss 되는 경우는 1회 suppress.
  useEffect(() => {
    if (!visible) return;

    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (suppressCloseOnKeyboardHideRef.current) {
        suppressCloseOnKeyboardHideRef.current = false;
        return;
      }
      onClose?.();
    });
    return () => sub.remove();
  }, [onClose, visible]);

  return (
    <>
      {/* Host TextInput: 키보드 + InputAccessoryView 트리거 (화면 밖) */}
      <TextInput
        ref={hostInputRef}
        inputAccessoryViewID={accessoryId}
        value={formState.title ?? ''}
        onChangeText={(t) => handleChange('title', t)}
        onSubmitEditing={submitQuick}
        returnKeyType="done"
        blurOnSubmit={false}
        style={styles.hostInput}
      />

      <InputAccessoryView nativeID={accessoryId}>
        <View style={styles.container}>
          <QuickInput
            title={formState.title}
            onRequestFocus={requestFocus}
            onSubmit={submitQuick}
            categoryName={quickModeLabels.categoryName}
            onCategoryPress={() => expandToDetail('CATEGORY')}
            dateLabel={quickModeLabels.dateLabel}
            onDatePress={() => expandToDetail('DATE')}
            repeatLabel={quickModeLabels.repeatLabel}
            onRepeatPress={() => expandToDetail('REPEAT')}
          />
        </View>
      </InputAccessoryView>
    </>
  );
}

const styles = StyleSheet.create({
  hostInput: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
});
