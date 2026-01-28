Dynamic Sizing
Dynamic Sizing is one of the powerful feature that v5 introduces, where the library internally managed to calculate static views and list content size height and set it as the bottom sheet content height.

info
The mechanism was introduce previously with useBottomSheetDynamicSnapPoints hook which been deprecated with the new release.

Usage
In order to enable the dynamic sizing to work properly, you would need to follow these rules:

Use the pre-configured Scrollables views, including the static view BottomSheetView.
In order to prevent the bottom sheet a exceeding certain height, you will need to set maxDynamicContentSize prop.
And remember, you can always disable the feature if its not needed by overriding the prop enableDynamicSizing with false.