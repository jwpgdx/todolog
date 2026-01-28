import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * BaseInput - 공통 Input 컴포넌트
 * 
 * TextInputComponent를 주입받아 일반 TextInput 또는 BottomSheetTextInput을
 * 동일한 UI로 사용할 수 있게 합니다.
 * 
 * @param {React.ComponentType} TextInputComponent - TextInput 또는 BottomSheetTextInput
 */
function BaseInput({
    TextInputComponent,
    label,
    error,
    icon,
    secureTextEntry,
    containerStyle,
    multiline = false,
    numberOfLines = 5,
    value,
    onChangeText,
    ...props
}) {

    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isSecure = secureTextEntry && !isPasswordVisible;
    const hasValue = value && value.length > 0;

    return (
        <View style={[styles.container, containerStyle]}>
            {/* Label */}
            {label && (
                <Text style={styles.label}>{label}</Text>
            )}

            {/* Input Container */}
            <View
                style={[
                    styles.inputWrapper,
                    multiline && styles.inputWrapperMultiline,
                    error && styles.inputWrapperError,
                ]}
            >
                {/* Left Icon */}
                {icon && (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={error ? '#EF4444' : '#9CA3AF'}
                        style={[styles.icon, multiline && styles.iconMultiline]}
                    />
                )}

                {/* Text Input (주입된 컴포넌트 사용) */}
                <TextInputComponent
                    style={[
                        styles.input,
                        multiline && styles.inputMultiline,
                    ]}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={isSecure}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoCapitalize="none"
                    clearButtonMode={multiline ? 'never' : 'while-editing'}
                    multiline={multiline}
                    textAlignVertical={multiline ? 'top' : 'center'}
                    numberOfLines={numberOfLines}
                    value={value}
                    onChangeText={onChangeText}
                    {...props}
                />

                {/* Right Icons */}
                <View style={[styles.rightIcons, multiline && styles.rightIconsMultiline]}>
                    {/* Clear Button */}
                    {hasValue && !secureTextEntry && (
                        <TouchableOpacity
                            onPress={() => onChangeText('')}
                            style={styles.iconButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close-circle" size={18} color="#C7C7CC" />
                        </TouchableOpacity>
                    )}

                    {/* Password Toggle */}
                    {secureTextEntry && (
                        <TouchableOpacity
                            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                            style={[styles.iconButton, styles.passwordToggle]}
                        >
                            <Ionicons
                                name={isPasswordVisible ? 'eye-off' : 'eye'}
                                size={20}
                                color="#9CA3AF"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Error Message */}
            {error && (
                <Text style={styles.error}>{error}</Text>
            )}
        </View>
    );
}

export default React.memo(BaseInput);

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    inputWrapper: {
        width: '100%',
        paddingHorizontal: 16,
        borderRadius: 12,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    inputWrapperMultiline: {
        height: undefined,
        paddingVertical: 12,
        alignItems: 'flex-start',
    },
    inputWrapperError: {
        backgroundColor: '#FEF2F2',
    },
    icon: {
        marginRight: 8,
    },
    iconMultiline: {
        marginTop: 2,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#111827',
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    inputMultiline: {
        height: 128,
    },
    rightIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rightIconsMultiline: {
        marginTop: 4,
    },
    iconButton: {
        padding: 4,
    },
    passwordToggle: {
        marginLeft: 8,
    },
    error: {
        marginTop: 4,
        marginLeft: 4,
        fontSize: 12,
        color: '#EF4444',
    },
});
