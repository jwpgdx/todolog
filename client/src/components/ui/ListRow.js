import { View, Text, TouchableOpacity } from 'react-native';

/**
 * ListRow Component
 * iOS-style list row item.
 * 
 * @param {string} title - Main text
 * @param {string} [description] - Sub text (optional)
 * @param {React.ReactNode} [left] - Left content (Icon, etc.)
 * @param {React.ReactNode} [right] - Right content (Icon, Switch, Text, etc.)
 * @param {Function} [onPress] - Press handler. If provided, renders simplified Touchable.
 * @param {boolean} [destructive] - If true, title is red.
 * @param {string} [className] - Additional styles.
 * @param {number} [zIndex] - z-index for dropdown support
 * @param {boolean} [overflowVisible] - Enable overflow visible for dropdown
 */
export default function ListRow({
    title,
    description,
    left,
    right,
    onPress,
    destructive = false,
    className = '',
    zIndex,
    overflowVisible = false,
}) {
    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            className={`flex-row items-center px-4 min-h-[50px] bg-white ${className}`}
            style={{
                zIndex: zIndex,
                overflow: overflowVisible ? 'visible' : undefined,
            }}
        >
            {/* Left Content */}
            {left && (
                <View className="pr-4">
                    {left}
                </View>
            )}

            {/* Main Content */}
            <View className="flex-1 flex-col">
                {/* Separator */}
                <View className="h-px bg-gray-200 w-full"></View>

                {/* Title and Right Content */}
                <View className="flex-row items-center flex-1">
                    {/* Text Content */}
                    <View className="flex-1 justify-center py-3">
                        <Text
                            className={`text-base ${destructive ? 'text-red-500' : 'text-gray-900'}`}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                        {description && (
                            <Text className="text-sm text-gray-500" numberOfLines={2}>
                                {description}
                            </Text>
                        )}
                    </View>

                    {/* Right Content */}
                    {right && (
                        <View className="flex-row items-center">
                            {right}
                        </View>
                    )}
                </View>
            </View>
        </Container>
    );
}
