Other
Other useful configuration setups.

Non-modal
Set the modal prop to false to allow interaction with the background while the drawer is open.

previewcode

Copy
Code
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
 
Non-dismissible
Set the dismissible prop to false to prevent the user from closing the drawer by clicking outside of it, pressing the escape key, or dragging it down. Don't open this one or else you'll have to refresh the page to close it.

previewcode

Copy
Code
'use client';
 
import { Drawer } from 'vaul';
import React from 'react';
 
export default function VaulDrawer() {
  const [isOpen, setIsOpen] = React.useState(false);
 
  return (
    <Drawer.Root dismissible={false} open={isOpen} onOpenChange={setIsOpen}>
      <Drawer.Trigger className="relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white">
        Open Drawer
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-gray-100 flex flex-col rounded-t-[10px] mt-24 h-fit fixed bottom-0 left-0 right-0 outline-none">
          <div className="p-4 bg-white rounded-t-[10px] flex-1">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
            <div className="max-w-md mx-auto">
              <Drawer.Title className="font-medium mb-4 text-gray-900">A non-dismissible drawer.</Drawer.Title>
              <p className="text-gray-600 mb-2">For cases when your drawer has to be always visible.</p>
              <p className="text-gray-600 mb-2">
                Nothing will close it unless you make it controlled and close it programmatically.
              </p>
              <button
                className="rounded-md mt-4 w-full bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
                onClick={() => setIsOpen(false)}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
 
Dynamic Drawer
Recreation of the Family drawer using Vaul. We build this on together in Animations on the Web.

preview
Open Drawer