import React from 'react';
import { Drawer } from 'vaul';
import { View, Text, TouchableOpacity } from 'react-native';

// Wrapper for Vaul to work within React Native Web environment if needed, 
// but since we are in a web file, we can mix HTML/React DOM elements carefully or use proper styling.
// Note: 'vaul' uses standard HTML elements.

export default function BottomSheetWebTest() {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {/* 
        Ideally, we should ensure the Drawer.Root is high enough in the tree or properly portalled.
        For this test, we accept it might be rendered within the view.
        'vaul' portals by default so it should break out of the RN view.
      */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Web Bottom Sheet (Vaul)</Text>

            <Drawer.Root shouldScaleBackground>
                <Drawer.Trigger asChild>
                    <button className="bg-black text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2">
                        Open Web Drawer
                    </button>
                </Drawer.Trigger>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
                    <Drawer.Content className="bg-white flex flex-col rounded-t-[10px] h-[96%] mt-24 fixed bottom-0 left-0 right-0 z-50">
                        <div className="p-4 bg-white rounded-t-[10px] flex-1">
                            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
                            <div className="max-w-md mx-auto">
                                <Drawer.Title className="font-medium mb-4 text-xl">
                                    Vaul Drawer for Web
                                </Drawer.Title>
                                <p className="text-gray-600 mb-2">
                                    This component is using <code>vaul</code>, a drawer component for React.
                                </p>
                                <p className="text-gray-600 mb-8">
                                    It mimics the native iOS sheet behavior.
                                </p>

                                <div className="bg-gray-100 p-4 rounded-lg">
                                    <p className="text-sm">Content goes here...</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white border-t border-gray-100 mt-auto">
                            <div className="max-w-md mx-auto">
                                <p className="text-center text-xs text-gray-400">Powered by Vaul</p>
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            <Text style={{ marginTop: 20, color: '#666' }}>
                Note: This uses HTML button and Vaul drawer.
            </Text>
        </View>
    );
}
