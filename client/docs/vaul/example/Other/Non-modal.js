'use client';

import { Drawer } from 'vaul';

export default function VaulDrawer() {
    return (
        <Drawer.Root modal={false}>
            <Drawer.Trigger className="relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white">
                Open Drawer
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40" />
                <Drawer.Content className="bg-gray-100 flex flex-col rounded-t-[10px] mt-24 h-fit fixed bottom-0 left-0 right-0 outline-none border-t border-gray-200">
                    <div className="p-4 bg-white rounded-t-[10px] flex-1">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
                        <div className="max-w-md mx-auto">
                            <Drawer.Title className="font-medium mb-4 text-gray-900">What does non-modal mean?</Drawer.Title>
                            <p className="text-gray-600 mb-2">
                                The default behavior for the drawer is to restrict interactions to the dialog itself. This means that
                                you can&apos;t interact with other content on the page.
                            </p>
                            <p className="text-gray-600 mb-2">
                                But sometimes you want to allow those interactions. Setting `modal` to `false` will let you scroll the
                                page, click on other elements, etc.
                            </p>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}