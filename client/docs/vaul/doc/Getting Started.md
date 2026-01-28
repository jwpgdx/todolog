Getting Started
Vaul is a drawer component for React. You can read about how it was built here.

Installation
Simply pnpm/npm/yarn install the package.

Terminal

pnpm i vaul
Create a Drawer component
It can be placed anywhere in your app.

MyDrawer.tsx

'use client';
 
import { Drawer } from 'vaul';
 
export default function VaulDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger>Open Drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-gray-100 h-fit fixed bottom-0 left-0 right-0 outline-none">
          <div className="p-4 bg-white">{/* Content */}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}