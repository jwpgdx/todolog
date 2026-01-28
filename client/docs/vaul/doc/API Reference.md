API Reference
What components are available in Vaul and how to use them.

Anatomy
Import all parts and piece them together.

import { Drawer } from 'vaul';
 
export function MyDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger />
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content>
          <Drawer.Handle />
          <Drawer.Title />
          <Drawer.Description />
          <Drawer.Close />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
Components API
Description of props of each component.

Root
Contains all the parts of a drawer.

Prop	Type	Default
defaultOpen

boolean
-
open

boolean
-
onOpenChange

function

-
modal

boolean
true
container

HTMLElement
document.body
direction

directionType

bottom
onAnimationEnd

function

-
dismissible

boolean
true
handleOnly

boolean
false
repositionInputs

boolean
true
 
  Additional props for snap points:

Prop	Type	Default
snapPoints

array

-
activeSnapPoint

boolean
-
setActiveSnapPoint

function

-
fadeFromIndex

number
-
snapToSequentialPoint

boolean
-
Trigger
The button that opens the drawer.

Prop	Type	Default
asChild

boolean
false
Portal
When used, portals your overlay and content parts into the body. No props.

Overlay
A layer that covers the inert portion of the view when the drawer is open.

Prop	Type	Default
asChild

boolean
false
Content
Contains content to be rendered in the open drawer.

Prop	Type	Default
asChild

boolean
false
Close
The button that closes the drawer.

Prop	Type	Default
asChild

boolean
false
Title
An optional accessible title to be announced when the drawer is opened.

Prop	Type	Default
asChild

boolean
false
Description
An optional accessible description to be announced when the drawer is opened.

Prop	Type	Default
asChild

boolean
false
Handle
An optional handle to drag the drawer. No Props.