Usage
If you are familiar with FlatList, you already know how to use FlashList. You can try out FlashList by changing the component name.

import React from "react";
import { View, Text, StatusBar } from "react-native";
import { FlashList } from "@shopify/flash-list";

const DATA = [
  {
    title: "First Item",
  },
  {
    title: "Second Item",
  },
];

const MyList = () => {
  return (
    <FlashList
      data={DATA}
      renderItem={({ item }) => <Text>{item.title}</Text>}
    />
  );
};

Important things to know
To avoid common pitfalls, you can also follow these steps for migrating from FlatList, based on our own experience.

Simply change from FlatList to FlashList and render the list.
Important: Scan your renderItem hierarchy for explicit key prop definitions and remove them. If you’re doing a .map() use our hook called useMappingHelper.
Check your renderItem hierarchy for components that make use of useState and verify whether that state would need to be reset if a different item is passed to that component (see Recycling)
If your list has heterogenous views, pass their types to FlashList using getItemType prop to improve performance.
Do not test performance with JS dev mode on. Make sure you’re in release mode. FlashList can appear slower while in dev mode due to a small render buffer.
Memoizing props passed to FlashList is more important in v2. v1 was more selective about updating items, but this was often perceived as a bug by developers. We will not follow that approach and will instead allow developers to ensure that props are memoized. We will stop re-renders of children wherever it is obvious.
keyExtractor is important to prevent glitches due to item layout changes when going upwards. We highly recommend having a valid keyExtractor with v2.
Read about new hooks that simplify recycling and reacting to layout changes: useLayoutState, useRecyclingState
If you're nesting horizontal FlashLists in vertical lists, we highly recommend the vertical list to be FlashList too. We have optimizations to wait for child layout to complete which can improve load times.
Props
renderItem
note
Required

renderItem: ({ item, index, target, extraData }) => void;

Takes an item from data and renders it into the list. Typical usage:

renderItem = ({item}) => (
  <Text>{item.title}</Text>
);
...
<FlashList data={[{title: 'Title Text', key: 'item1'}]} renderItem={renderItem} />


Provides additional metadata like index

item (Object): The item from data being rendered.
index (number): The index corresponding to this item in the data array.
target (string): FlashList may render your items for multiple reasons.
Cell - This is for your list item.
Measurement - Might be invoked for size measurement and won't be visible. You can ignore this in analytics.
StickyHeader - This is for your sticky header. Use this to change your item's appearance while it's being used as a sticky header.
extraData (Object) - This is the same extraData prop that was passed to FlashList.
data
note
Required

For simplicity, data is a plain array of items of a given type.

data: ItemT[];

CellRendererComponent
Each cell is rendered using this element. Can be a React Component Class, or a render function. The root component should always be a CellContainer which is also the default component used. Ensure that the original props are passed to the returned CellContainer. The props contain the following properties:

onLayout: Method for updating data about the real CellContainer layout
index: Index of the cell in the list, you can use this to query data if needed
style: Style of CellContainer, including:
flexDirection: Depends on whether your list is horizontal or vertical
position: Value of this will be absolute as that's how FlashList positions elements
left: Determines position of the element on x axis
top: Determines position of the element on y axis
width: Determines width of the element (present when list is vertical)
height: Determines height of the element (present when list is horizontal)
When using with react-native-reanimated, you can wrap CellContainer in Animated.createAnimatedComponent (this is similar to using Animated.View):

const AnimatedCellContainer = Animated.createAnimatedComponent(CellContainer);
return (
  <FlashList
    CellRendererComponent={(props) => {
      return (
          <AnimatedCellContainer {...props} style={...}>
      );
    }}
  />
);


CellRendererComponent?: React.ComponentType<any> | undefined;

ItemSeparatorComponent
Rendered in between each item, but not at the top or bottom. By default, leadingItem and trailingItem (if available) props are provided.

ItemSeparatorComponent?: React.ComponentType<any>;

ListEmptyComponent
Rendered when the list is empty. Can be a React Component (e.g. SomeComponent), or a React element (e.g. <SomeComponent />).

ListEmptyComponent?: React.ComponentType<any> | React.ReactElement<any, string | React.JSXElementConstructor<any>>;


ListFooterComponent
Rendered at the bottom of all the items. Can be a React Component (e.g. SomeComponent), or a React element (e.g. <SomeComponent />).

ListFooterComponent?: React.ComponentType<any> | React.ReactElement<any, string | React.JSXElementConstructor<any>>;


ListFooterComponentStyle
Styling for internal View for ListFooterComponent.

ListFooterComponentStyle?: StyleProp<ViewStyle>;

ListHeaderComponent
Rendered at the top of all the items. Can be a React Component (e.g. SomeComponent), or a React element (e.g. <SomeComponent />).

ListHeaderComponent?: React.ComponentType<any> | React.ReactElement<any, string | React.JSXElementConstructor<any>>;


ListHeaderComponentStyle
Styling for internal View for ListHeaderComponent.

ListHeaderComponentStyle?: StyleProp<ViewStyle>;

contentContainerStyle
contentContainerStyle?: ContentStyle;

export type ContentStyle = Pick<
  ViewStyle,
  | "backgroundColor"
  | "paddingTop"
  | "paddingLeft"
  | "paddingRight"
  | "paddingBottom"
  | "padding"
  | "paddingVertical"
  | "paddingHorizontal"
>;

You can use contentContainerStyle to apply padding that will be applied to the whole content itself. For example, you can apply this padding, so that all of your items have leading and trailing space.

drawDistance
drawDistance?: number;

Draw distance for advanced rendering (in dp/px).

extraData
A marker property for telling the list to re-render (since it implements PureComponent). If any of your renderItem, Header, Footer, etc. functions depend on anything outside of the data prop, stick it here and treat it immutably.

extraData?: any;

horizontal
If true, renders items next to each other horizontally instead of stacked vertically. Default is false.

horizontal?: boolean;

initialScrollIndex
Instead of starting at the top with the first item, start at initialScrollIndex.

initialScrollIndex?: number;

initialScrollIndexParams
Additional configuration for initialScrollIndex. Use viewOffset to apply an offset to the initial scroll position as defined by initialScrollIndex. Ignored if initialScrollIndex is not set.

initialScrollIndexParams?: { viewOffset?: number };

keyExtractor
keyExtractor?: (item: object, index: number) => string;

Used to extract a unique key for a given item at the specified index. Key is used for optimizing performance. Defining keyExtractor is also necessary when doing layout animations to uniquely identify animated components.

maintainVisibleContentPosition
maintainVisibleContentPosition?: {
  disabled?: boolean;
  autoscrollToTopThreshold?: number;
  autoscrollToBottomThreshold?: number;
  startRenderingFromBottom?: boolean;
};

Configuration for maintaining scroll position when content changes. This is enabled by default to reduce visible glitches.

disabled: Set to true to disable this feature. It's enabled by default.
autoscrollToTopThreshold: Automatically scroll to maintain position when content is added at the top.
autoscrollToBottomThreshold: Automatically scroll to maintain position when content is added at the bottom.
animateAutoScrollToBottom: Scroll with animation whenever autoScrollToBottom is triggered. Default is true.
startRenderingFromBottom: If true, initial render will start from the bottom, useful for chat interfaces.
Example:

<FlashList
  data={chatMessages}
  maintainVisibleContentPosition={{
    autoscrollToBottomThreshold: 0.2,
    startRenderingFromBottom: true,
  }}
  renderItem={({ item }) => <ChatMessage message={item} />}
/>

masonry
masonry?: boolean;

Enable masonry layout for grid-like interfaces with varying item heights. When used with numColumns > 1, this creates a masonry-style layout.

<FlashList
  data={data}
  masonry
  numColumns={3}
  renderItem={({ item }) => <MasonryItem item={item} />}
/>

maxItemsInRecyclePool
Maximum number of items in the recycle pool. These are the items that are cached in the recycle pool when they are scrolled off the screen. Unless you have a huge number of item types, you shouldn't need to set this.

Setting this to 0, will disable the recycle pool and items will unmount once they are scrolled off the screen. There's no limit by default.

numColumns
Multiple columns can only be rendered with horizontal={false} and will zig-zag like a flexWrap layout. Items should all be the same height - masonry layouts are not supported.

numColumns?: number;

stickyHeaderConfig
Configuration object for sticky header behavior and appearance. All properties are optional.

stickyHeaderConfig?: {
  useNativeDriver?: boolean;
  offset?: number;
  backdropComponent?: React.ComponentType<any> | React.ReactElement | null;
  hideRelatedCell?: boolean;
};

useNativeDriver
If true, the sticky headers will use native driver for animations. Default is true.

useNativeDriver?: boolean;

offset
Offset from the top of the list where sticky headers should stick. This is useful when you have a fixed header or navigation bar at the top of your screen and want sticky headers to appear below it instead of at the very top. Default is 0.

offset?: number;

backdropComponent
Component to render behind sticky headers (e.g., a backdrop or blur effect). Renders in front of the scroll view content but behind the sticky header itself. Useful for creating visual separation or effects like backgrounds with blur.

backdropComponent?: React.ComponentType<any> | React.ReactElement | null;

hideRelatedCell
When a sticky header is displayed, the cell associated with it is hidden. Default is false.

hideRelatedCell?: boolean;

Example:

<FlashList
  data={sectionData}
  stickyHeaderIndices={[0, 10, 20]}
  stickyHeaderConfig={{
    useNativeDriver: true,
    offset: 50, // Headers stick 50px from top
    backdropComponent: <BlurView style={StyleSheet.absoluteFill} />,
    hideRelatedCell: true,
  }}
  renderItem={({ item }) => <ListItem item={item} />}
/>

onChangeStickyIndex
Callback invoked when the currently displayed sticky header changes as you scroll. Receives the current sticky header index and the previous sticky header index. This is useful for tracking which header is currently stuck at the top while scrolling. The index refers to the position of the item in your data array that's being used as a sticky header.

onChangeStickyIndex?: (current: number, previous: number) => void;

Example:

<FlashList
  data={sectionData}
  stickyHeaderIndices={[0, 10, 20]}
  onChangeStickyIndex={(current, previous) => {
    console.log(`Sticky header changed from ${previous} to ${current}`);
  }}
  renderItem={({ item }) => <ListItem item={item} />}
/>

onBlankArea
onBlankArea?: (blankAreaEvent: {
    offsetStart: number;
    offsetEnd: number;
    blankArea: number;
}) => void;

FlashList computes blank space that is visible to the user during scrolling or the initial loading of the list.

Values reported:

offsetStart: visible blank space on top of the screen (while going up). If value is greater than 0, it's visible to user.
offsetEnd: visible blank space at the end of the screen (while going down). If value is greater than 0, it's visible to user.
blankArea: maximum of offsetStart and offsetEnd. You might see negative values indicating that items are rendered outside the list's visible area.
warning
This callback will be triggered even if the blanks are excepted - for example, when the list does not have enough items to fill the screen.

note
This event isn't synced with onScroll event from the JS layer but works with native methods onDraw (Android) and layoutSubviews (iOS).

onCommitLayoutEffect
onCommitLayoutEffect?: () => void;

Called before layout is committed. Can be used to measure list and make changes before paint. Doing setState inside the callback can lead to infinite loops. Make sure FlashList's props are memoized.

onEndReached
onEndReached?: () => void;

Called once when the scroll position gets within onEndReachedThreshold of the rendered content.

onEndReachedThreshold
onEndReachedThreshold?: number;

How far from the end (in units of visible length of the list) the bottom edge of the list must be from the end of the content to trigger the onEndReached callback. Thus a value of 0.5 will trigger onEndReached when the end of the content is within half the visible length of the list.

onLoad
onLoad: (info: { elapsedTimeInMs: number }) => void;

This event is raised once the list has drawn items on the screen. It also reports elapsedTimeInMs which is the time it took to draw the items. This is required because FlashList doesn't render items in the first cycle. Items are drawn after it measures itself at the end of first render. Please note that the event is not fired if ListEmptyComponent is rendered.

onRefresh
onRefresh?: () => void;

If provided, a standard RefreshControl will be added for "Pull to Refresh" functionality. Make sure to also set the refreshing prop correctly.

getItemType
getItemType?: (
    item: T,
    index: number,
    extraData?: any
) => string | number | undefined;

Allows developers to specify item types. This will improve recycling if you have different types of items in the list. Right type will be used for the right item.Default type is 0. If you don't want to change for an indexes just return undefined. You can see example of how to use this prop here.

Performance
This method is called very frequently. Keep it fast.

onStartReached
onStartReached?: () => void;

Called once when the scroll position gets within onStartReachedThreshold of the start of the content. Useful for loading older content in infinite scroll scenarios like chat applications.

<FlashList
  data={messageData}
  onStartReached={() => loadOlderMessages()}
  onStartReachedThreshold={0.1}
  renderItem={({ item }) => <MessageItem message={item} />}
/>

onStartReachedThreshold
onStartReachedThreshold?: number;

How far from the start (in units of visible length of the list) the top edge of the list must be from the start of the content to trigger the onStartReached callback. Value of 0.5 will trigger onStartReached when the start of the content is within half the visible length of the list from the top.

onViewableItemsChanged
interface ViewToken {
  index: number;
  isViewable: boolean;
  item: string;
  key: string;
  timestamp: number;
}

onViewableItemsChanged?: ((info: {
    viewableItems: ViewToken[];
    changed: ViewToken[];
}) => void) | null | undefined

Called when the viewability of rows changes, as defined by the viewabilityConfig prop. Array of changed includes ViewTokens that both visible and non-visible items. You can use the isViewable flag to filter the items.

note
If you are tracking the time a view becomes (non-)visible, use the timestamp property. We make no guarantees that in the future viewability callbacks will be invoked as soon as they happen - for example, they might be deferred until JS thread is less busy.

optimizeItemArrangement
optimizeItemArrangement?: boolean;

When enabled with masonry layout, this will try to reduce differences in column height by modifying item order. Default is true.

overrideItemLayout
overrideItemLayout?: (
    layout: { span?: number;},
    item: T,
    index: number,
    maxColumns: number,
    extraData?: any
) => void;

This method can be used to change column span of an item.

In v2, span is supported, but size estimates are no longer needed or read.

Changing item span is useful when you have grid layouts (numColumns > 1) and you want few items to be bigger than the rest.

<FlashList
  data={gridData}
  numColumns={2}
  overrideItemLayout={(layout, item) => {
    layout.span = item.span; // Set span
  }}
  renderItem={({ item }) => <GridItem item={item} />}
/>

Performance
This method is called very frequently. Keep it fast.

overrideProps
overrideProps?: object;

We do not recommend using this prop for anything else than debugging. Internal props of the list will be overriden with the provided values.

progressViewOffset
progressViewOffset?: number;

Set this when offset is needed for the loading indicator to show correctly.

refreshControl
refreshControl?: React.ReactElement<any, string | React.JSXElementConstructor<any>>;


A custom refresh control element. When set, it overrides the default <RefreshControl> component built internally. The onRefresh and refreshing props are also ignored. Only works for vertical VirtualizedList.

refreshing
refreshing?: boolean;

Set this true while waiting for new data from a refresh.

renderScrollComponent
import type { ScrollViewProps } from "react-native";

renderScrollComponent?:
    | React.ComponentType<ScrollViewProps>
    | React.FC<ScrollViewProps>;

Rendered as the main scrollview.

style
style?: StyleProp<ViewStyle>;

Style for the FlashList's parent container. It's highly recommended to avoid adding padding which can impact the size of the ScrollView inside. We operate on the assumption that the size of parent view and ScrollView is the same. In most cases, contentContainerStyle should be enough, so avoid using this.

viewabilityConfig
interface ViewabilityConfig: {
  minimumViewTime: number;
  viewAreaCoveragePercentThreshold: number;
  itemVisiblePercentThreshold: number;
  waitForInteraction: boolean;
}

viewabilityConfig?: ViewabilityConfig;

viewabilityConfig is a default configuration for determining whether items are viewable.

warning
Changing viewabilityConfig on the fly is not supported

Example:

<FlashList
    viewabilityConfig={{
      waitForInteraction: true,
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 1000,
    }}
  ...

minimumViewTime
Minimum amount of time (in milliseconds) that an item must be physically viewable before the viewability callback will be fired. A high number means that scrolling through content without stopping will not mark the content as viewable. The default value is 250. We do not recommend setting much lower values to preserve performance when quickly scrolling.

viewAreaCoveragePercentThreshold
Percent of viewport that must be covered for a partially occluded item to count as "viewable", 0-100. Fully visible items are always considered viewable. A value of 0 means that a single pixel in the viewport makes the item viewable, and a value of 100 means that an item must be either entirely visible or cover the entire viewport to count as viewable.

itemVisiblePercentThreshold
Similar to viewAreaCoveragePercentThreshold, but considers the percent of the item that is visible, rather than the fraction of the viewable area it covers.

waitForInteraction
Nothing is considered viewable until the user scrolls or recordInteraction is called after render.

viewabilityConfigCallbackPairs
type ViewabilityConfigCallbackPairs = ViewabilityConfigCallbackPair[];

interface ViewabilityConfigCallbackPair {
  viewabilityConfig: ViewabilityConfig;
  onViewableItemsChanged:
    | ((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => void)
    | null;
}

viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs | undefined;

List of ViewabilityConfig/onViewableItemsChanged pairs. A specific onViewableItemsChanged will be called when its corresponding ViewabilityConfig's conditions are met.

Hooks
useLayoutState
const [state, setState] = useLayoutState(initialState);

This is similar to useState but communicates the change in state to FlashList. It's useful if you want to resize a child component based on a local state. Item layout changes will still be detected using onLayout callback in the absence of useLayoutState, which might not look as smooth on a case-by-case basis.

import { useLayoutState } from "@shopify/flash-list";

const MyItem = ({ item }) => {
  const [isExpanded, setIsExpanded] = useLayoutState(false);
  const height = isExpanded ? 150 : 80;

  return (
    <Pressable onPress={() => setIsExpanded(!isExpanded)}>
      <View style={{ height, padding: 16 }}>
        <Text>{item.title}</Text>
      </View>
    </Pressable>
  );
};

useRecyclingState
const [state, setState] = useRecyclingState(
  initialState,
  dependencies,
  resetCallback
);

Similar to useState but accepts a dependency array. On change of deps, the state gets reset without an additional setState call. Useful for maintaining local item state if really necessary. It also has the functionality of useLayoutState built in.

import { useRecyclingState } from "@shopify/flash-list";

const GridItem = ({ item }) => {
  const [isExpanded, setIsExpanded] = useRecyclingState(
    false,
    [item.id],
    () => {
      // runs on reset. Can be used to reset scroll positions of nested horizontal lists
    }
  );
  const height = isExpanded ? 100 : 50;

  return (
    <Pressable onPress={() => setIsExpanded(!isExpanded)}>
      <View style={{ height, backgroundColor: item.color }}>
        <Text>{item.title}</Text>
      </View>
    </Pressable>
  );
};


useMappingHelper
const { getMappingKey } = useMappingHelper();

Returns a function that helps create a mapping key for items when using .map() in your render methods. Using this ensures that performance is optimal for FlashList by providing consistent keys that work with the recycling system.

The getMappingKey function takes two parameters:

index: The index of the item in the array
itemKey: A unique identifier for the item (string, number, or bigint)
It returns the appropriate key value to use in the key prop based on the current context.

Basic usage:

import { useMappingHelper } from "@shopify/flash-list";

const MyComponent = ({ items }) => {
  const { getMappingKey } = useMappingHelper();

  return (
    <View>
      {items.map((item, index) => (
        <Text key={getMappingKey(item.id, index)}>{item.title}</Text>
      ))}
    </View>
  );
};

When to use it:

When mapping over arrays to create lists of components inside FlashList items
When building nested components that render multiple items from an array
To ensure consistent key generation that works well with FlashList's recycling system
useFlashListContext
Exposes helpers to easily access ref of FlashList. It also exposes ref of ScrollView. Ideal for use within child components or CellRendererComponent.

FlashList methods
prepareForLayoutAnimationRender()
prepareForLayoutAnimationRender(): void;

Run this method before running layout animations, such as when animating an element when deleting it. This method disables recycling for the next frame so that layout animations run well.

warning
Avoid using this when making large changes to the data as the list might draw too much to run animations since the method disables recycling temporarily. Single item insertions or deletions should animate smoothly. The render after animation will enable recycling again and you can stop avoiding making large data changes.

recordInteraction()
recordInteraction();

Tells the list an interaction has occurred, which should trigger viewability calculations, e.g. if waitForInteractions is true and the user has not scrolled. You should typically call recordInteraction() when user for example taps on an item or invokes a navigation action.

recomputeViewableItems()
recomputeViewableItems();

Retriggers viewability calculations. Useful to imperatively trigger viewability calculations.

scrollToEnd()
scrollToEnd?: (params?: { animated?: boolean | null | undefined });

Scrolls to the end of the content.

scrollToIndex()
scrollToIndex(params: {
  animated?: boolean | null | undefined;
  index: number;
  viewOffset?: number | undefined;
  viewPosition?: number | undefined;
});

Scroll to a given index.

scrollToItem()
scrollToItem(params: {
  animated?: boolean | null | undefined;
  item: any;
  viewPosition?: number | undefined;
});

Scroll to a given item.

scrollToOffset()
scrollToOffset(params: {
  animated?: boolean | null | undefined;
  offset: number;
});

Scroll to a specific content pixel offset in the list.

Param offset expects the offset to scroll to. In case of horizontal is true, the offset is the x-value, in any other case the offset is the y-value.

Param animated (false by default) defines whether the list should do an animation while scrolling.

getVisibleIndices()
Returns an array of indices that are currently visible in the list.

getVisibleIndices(): number[];

getLayout()
Returns the current layout information for the list.

getLayout(): { x: number, y: number, width: number; height: number };

flashScrollIndicators()
Shows the scroll indicators momentarily.

flashScrollIndicators(): void;

getNativeScrollRef()
Returns a reference to the underlying scroll view.

getNativeScrollRef(): React.RefObject<CompatScroller>;

getScrollResponder()
Returns the scroll responder of the underlying scroll view.

getScrollResponder(): any;

getScrollableNode()
Returns the native scrollable node of the underlying scroll view.

getScrollableNode(): any;

scrollToTop()
Scrolls to the top of the list.

scrollToTop(params?: { animated?: boolean }): void;

getFirstItemOffset()
Returns the offset of the first item (useful for calculating header size or top padding).

getFirstItemOffset(): number;

getWindowSize()
Returns the current rendered dimensions of the list.

getWindowSize(): { width: number, height: number };

getFirstVisibleIndex()
Returns the index of the first visible item in the list.

getFirstVisibleIndex(): number;

ScrollView props
FlashList, as FlatList, uses ScrollView under the hood. You can take a look into the React Native documentation for ScrollView to see the exhaustive list of props.

Unsupported FlatList props
The following props from FlatList are currently not implemented:

columnWrapperStyle
debug
listKey
There are also FlatList props that would bring no value if ported to FlashList due to the differences in their underlying implementation:

disableVirtualization
getItemLayout
initialNumToRender
maxToRenderPerBatch
recordInteraction
setNativeProps
updateCellsBatchingPeriod
onScrollToIndexFailed
windowSize
We don't currently plan to implement these props.



Layout Commit Observer
The LayoutCommitObserver is a utility component that helps you track when all FlashList components in your component tree have completed their layout. This is particularly useful for coordinating complex UI behaviors that depend on list rendering completion. Doing your own setState in this callback will block paint till your state change is ready to be committed.

Overview
When working with multiple FlashList components or when you need to perform actions after a FlashList has finished its render, the LayoutCommitObserver provides a clean way to observe and react to these layout events. Please note that the callback is fired after every layout operation and not just the first one.

When to Use
Measure size of views after all internal lists have rendered
Don't have access to FlashList for example, your component just accepts children prop.
When not to use
If you don't need to block paint then using the onLoad callback is a better approach.
If you only have one FlashList and have access to it. onCommitLayoutEffect is a prop on FlashList too.
Basic Usage
Wrap your component tree containing FlashLists with LayoutCommitObserver:

import { LayoutCommitObserver } from "@shopify/flash-list";

function MyScreen() {
  const handleLayoutComplete = () => {
    console.log("All FlashLists have completed their initial layout!");
    // Perform any post-layout actions here
  };

  return (
    <LayoutCommitObserver onCommitLayoutEffect={handleLayoutComplete}>
      <View>
        <FlashList data={data1} renderItem={renderItem1} />
        <FlashList data={data2} renderItem={renderItem2} />
      </View>
    </LayoutCommitObserver>
  );
}

Performance
Profiling
warning
Before assessing your list's performance, make sure you are in release mode. On Android, you can disable JS dev mode inside the developer menu, whereas you need to run the release configuration on iOS. FlashList can appear to be slower than FlatList in dev mode. The primary reason is a much smaller and fixed window size equivalent. Click here to know more about why you shouldn't profile with dev mode on.

Memoizing props passed to FlashList is more important in v2. v1 was more selective about updating items, but this was often perceived as a bug by developers. We will not follow that approach and will instead allow developers to ensure that props are memoized. We will stop re-renders of children wherever it is obvious.

Writing Performant Components
While FlashList does its best to achieve high performance, it will still perform poorly if your item components are slow to render. In this post, let's dive deeper into how you can remedy this.

Recycling
One important thing to understand is how FlashList works under the hood. When an item gets out of the viewport, instead of being destroyed, the component is re-rendered with a different item prop. When optimizing your item component, try to ensure as few things as possible have to be re-rendered and recomputed when recycling.

Optimizations
There's lots of optimizations that are applicable for any React Native component and which might help render times of your item components as well. Usage of useCallback, useMemo, and useRef is advised - but don't use these blindly, always measure the performance before and after making your changes.

note
Always profile performance in the release mode. FlashList's performance between JS dev and release mode differs greatly.

Remove key prop
warning
Using key prop inside your item and item's nested components will highly degrade performance.

Make sure your item components and their nested components don't have a key prop. Using this prop will lead to FlashList not being able to recycle views, losing all the benefits of using it over FlatList.

Why are keys harmful to FlashList?
FlashList's core performance advantage comes from recycling components instead of creating and destroying them however, when you add a key prop that changes between different data items, React treats the component as entirely different and forces a complete re-creation of the component tree.

For example, if we had a following item component:

const MyNestedComponent = ({ item }) => {
  return <Text key={item.id}>I am nested!</Text>;
};

const MyItem = ({ item }) => {
  return (
    <View key={item.id}>
      <MyNestedComponent item={item} />
      <Text>{item.title}</Text>
    </View>
  );
};

Then the key prop should be removed from both MyItem and MyNestedComponent. It isn't needed and react can alredy take care of updating the components.

const MyNestedComponent = ({ item }) => {
  return <Text>I am nested!</Text>;
};

const MyItem = ({ item }) => {
  return (
    <View>
      <MyNestedComponent item={item} />
      <Text>{item.title}</Text>
    </View>
  );
};

There might be cases where React forces you to use key prop, such as when using map. In such circumstances, use useMappingHelper to ensure optimal performance:

import { useMappingHelper } from "@shopify/flash-list";

const MyItem = ({ item }) => {
  const { getMappingKey } = useMappingHelper();

  return (
    <>
      {item.users.map((user, index) => (
        <Text key={getMappingKey(user.id, index)}>{user.name}</Text>
      ))}
    </>
  );
};

The useMappingHelper hook intelligently provides the right key strategy:

When inside FlashList: Uses stable keys that don't change during recycling
When outside FlashList: Uses the provided item key for proper React reconciliation
This approach ensures that:

Components can be recycled properly within FlashList
React's reconciliation works correctly
Performance remains optimal
info
useMappingHelper should be used whenever you need to map over arrays inside FlashList item components. It automatically handles the complexity of providing recycling-friendly keys.

Difficult calculations
If you do any calculations that might take a lot of resources, consider memoizing it, making it faster, or removing it altogether. The render method of items should be as efficient as possible:

getItemType
If you have different types of cell components and these are vastly different, consider leveraging the getItemType prop. For example, if we were building a messages list, we could write it like this:

// A message can be either a text or an image
enum MessageType {
  Text,
  Image,
}

interface TextMessage {
  text: string;
  type: MessageType.Text;
}

interface ImageMessage {
  image: ImageSourcePropType;
  type: MessageType.Image;
}

type Message = ImageMessage | TextMessage;

const MessageItem = ({ item }: { item: Message }) => {
  switch (item.type) {
    case MessageType.Text:
      return <Text>{item.text}</Text>;
    case MessageType.Image:
      return <Image source={item.image} />;
  }
};

// Rendering the actual messages list
const MessageList = () => {
  return <FlashList renderItem={MessageItem} />;
};

However, this implementation has one performance drawback. When the list recycles items and the MessageType changes from Text to Image or vice versa, React won't be able to optimize the re-render since the whole render tree of the item component changes. We can fix this by changing the MessageList to this:

const MessageList = () => {
  return (
    <FlashList
      renderItem={MessageItem}
      estimatedItemSize={200}
      getItemType={(item) => {
        return item.type;
      }}
    />
  );
};

FlashList will now use separate recycling pools based on item.type. That means we will never recycle items of different types, making the re-render faster.

Leaf components
Let's consider the following example:

const MyHeavyComponent = () => {
  return ...;
};

const MyItem = ({ item }) => {
  return (
    <>
      <MyHeavyComponent />
      <Text>{item.title}</Text>
    </>
  );
};

Since MyHeavyComponent does not directly depend on the item prop, memo can be used to skip re-rending MyHeavyComponent when the item is recycled and thus re-rendered:

const MyHeavyComponent = () => {
  return ...;
};

const MemoizedMyHeavyComponent = memo(MyHeavyComponent);

const MyItem = ({ item }: { item: any }) => {
  return (
    <>
      <MemoizedMyHeavyComponent />
      <Text>{item.title}</Text>
    </>
  );
};

Recycling
One important thing to understand is how FlashList works under the hood. When an item gets out of the viewport, instead of being destroyed, the component is re-rendered with a different item prop. For example, if you make use of useState in a reused component, you may see state values that were set for that component when it was associated with a different item in the list, and would then need to reset any previously set state when a new item is rendered.

FlashList now comes with useRecyclingState hook that can reset the state automatically without an additional render.

const MyItem = ({ item }) => {
  // value of liked is reset if deps array changes. The hook also accepts a callback to reset anything else if required.
  const [liked, setLiked] = useRecyclingState(item.liked, [item.someId], () => {
    // callback
  });

  return (
    <Pressable onPress={() => setLiked(true)}>
      <Text>{liked}</Text>
    </Pressable>
  );
};


When optimizing your item component, try to ensure as few things as possible have to be re-rendered and recomputed when recycling.

LayoutAnimation
LayoutAnimation is a popular way how to animate views in React Native.

FlashList does support LayoutAnimations but you need to call prepareForLayoutAnimationRender() before React Native's LayoutAnimation.configureNext. prepareForLayoutAnimationRender is an instance method, so you have to keep a reference to your FlashList instance via the ref prop:

// This must be called before `LayoutAnimation.configureNext` in order for the animation to run properly.
listRef.current?.prepareForLayoutAnimationRender();
// After removing the item, we can start the animation.
LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);


For the animation to work properly, you additionally need to add keyExtractor prop to your FlashList component if you have not already done so.

note
LayoutAnimation is experimental on Android, so we cannot guarantee its stability when used with FlashList.

Example
import React, { useRef, useState } from "react";
import { View, Text, Pressable, LayoutAnimation } from "react-native";
import { FlashList } from "@shopify/flash-list";

const List = () => {
  const [data, setData] = useState([1, 2, 3, 4, 5]);

  const list = useRef<FlashList<number> | null>(null);

  const removeItem = (item: number) => {
    setData(
      data.filter((dataItem) => {
        return dataItem !== item;
      })
    );
    // This must be called before `LayoutAnimation.configureNext` in order for the animation to run properly.
    list.current?.prepareForLayoutAnimationRender();
    // After removing the item, we can start the animation.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const renderItem = ({ item }: { item: number }) => {
    return (
      <Pressable
        onPress={() => {
          removeItem(item);
        }}
      >
        <View>
          <Text>Cell Id: {item}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <FlashList
      // Saving reference to the `FlashList` instance to later trigger `prepareForLayoutAnimationRender` method.
      ref={list}
      // This prop is necessary to uniquely identify the elements in the list.
      keyExtractor={(item: number) => {
        return item.toString();
      }}
      renderItem={renderItem}
      data={data}
    />
  );
};

export default List;

List Profiling with useBenchmark
The useBenchmark hook provides a comprehensive way to measure and analyze the performance of your FlashList implementation. It automatically scrolls through your list while collecting performance metrics and provides actionable suggestions for optimization.

Basic Usage
import { useRef } from "react";
import { FlashList, FlashListRef, useBenchmark } from "@shopify/flash-list";

function MyList() {
  const flashListRef = useRef<FlashListRef<MyDataType>>(null);

  // Basic benchmark setup
  useBenchmark(flashListRef, (result) => {
    console.log("Benchmark complete:", result.formattedString);
  });

  return <FlashList ref={flashListRef} data={data} renderItem={renderItem} />;
}


Manual Benchmark Control
For more control over when the benchmark runs, use the startManually option:

const { startBenchmark, isBenchmarkRunning } = useBenchmark(
  flashListRef,
  (result) => {
    if (!result.interrupted) {
      Alert.alert("Benchmark Complete", result.formattedString);
    }
  },
  {
    startManually: true,
    repeatCount: 3,
    speedMultiplier: 1.5,
  }
);

// Trigger benchmark on button press
<Button
  title={isBenchmarkRunning ? "Running..." : "Start Benchmark"}
  onPress={startBenchmark}
  disabled={isBenchmarkRunning}
/>;

Configuration Options
The useBenchmark hook accepts an optional BenchmarkParams object:

Parameter	Type	Default	Description
startDelayInMs	number	3000	Delay before automatic benchmark start (in milliseconds)
speedMultiplier	number	1	Multiplier for scroll speed (higher = faster scrolling)
repeatCount	number	1	Number of times to repeat the benchmark
startManually	boolean	false	Prevent automatic start, use returned startBenchmark function instead
Understanding Results
The benchmark returns a BenchmarkResult object containing:

interface BenchmarkResult {
  js?: {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
  };
  interrupted: boolean;
  suggestions: string[];
  formattedString?: string;
}

Key Metrics
Average FPS: The average JavaScript frames per second during scrolling
Min FPS: The lowest FPS recorded
Max FPS: The highest FPS recorded
Interpreting Results
Good Performance: Average FPS above 50
Acceptable Performance: Average FPS between 35-50
Poor Performance: Average FPS below 35
Performance Suggestions
The benchmark automatically provides suggestions based on your results:

Low JS FPS (< 35 FPS): Indicates components are doing too much work. Consider:

Optimizing render methods
Reducing component complexity
Implementing memoization
Minimizing re-renders
Small Dataset (< 200 items): Testing with larger datasets provides more realistic performance metrics

Example
const generateData = (count: number): DataItem[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Item ${index}`,
    value: Math.floor(Math.random() * 100),
  }));
};

const ManualBenchmarkExample = () => {
  const flashListRef = useRef<FlashListRef<DataItem>>(null);
  const [data] = useState(() => generateData(500));
  const [benchmarkResult, setBenchmarkResult] = useState<string>("");

  const { startBenchmark, isBenchmarkRunning } = useBenchmark(
    flashListRef,
    (result) => {
      if (!result.interrupted) {
        setBenchmarkResult(result.formattedString || "No results");
        Alert.alert("Benchmark Complete", result.formattedString);
      }
    },
    {
      startManually: true,
      repeatCount: 3,
      speedMultiplier: 1.5,
    }
  );

  const renderItem = ({ item }: { item: DataItem }) => (
    <View style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.value}>Value: {item.value}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Manual Benchmark Example</Text>
        <Button
          title={isBenchmarkRunning ? "Running..." : "Start Benchmark"}
          onPress={startBenchmark}
          disabled={isBenchmarkRunning}
        />
      </View>

      <FlashList
        ref={flashListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />

      {benchmarkResult ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{benchmarkResult}</Text>
        </View>
      ) : null}
    </View>
  );
};

Best Practices
Test with Production Data: Use realistic data sizes and complexity
Run Multiple Iterations: Use repeatCount for more accurate averages
Test on Target Devices: Performance varies significantly across devices
Benchmark Before and After: Compare results when making optimizations
Consider User Scenarios: Test with different scroll speeds using speedMultiplier

Masonry Layout
Masonry Layout allows you to create a grid of items with different heights. It is a great way to display a collection of images with different sizes.


FlashList with masonry prop (v2)
In v2, masonry layout is enabled using the masonry prop on FlashList.

import React from "react";
import { View, Text } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { DATA } from "./data";

const MyMasonryList = () => {
  return (
    <FlashList
      data={DATA}
      masonry
      numColumns={2}
      renderItem={({ item }) => <Text>{item.title}</Text>}
    />
  );
};

With overrideItemLayout
When you want to customize item layout (such as setting different spans), you can use overrideItemLayout:

import React from "react";
import { View, Text, Image } from "react-native";
import { FlashList } from "@shopify/flash-list";

interface MasonryItem {
  id: string;
  title: string;
  height: number;
  span: number; // Number of columns this item should span
  imageUrl: string;
}

const MyMasonryList = () => {
  return (
    <FlashList
      data={data}
      masonry
      numColumns={3}
      overrideItemLayout={(layout, item) => {
        // Set the span based on the item's span property
        layout.span = item.span;
        // Note: In v2, size estimates are no longer needed in overrideItemLayout
        // The actual height is determined by the rendered component
      }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: "#f0f0f0", margin: 4 }}>
          <Image source={{ uri: item.imageUrl }} style={{ flex: 1 }} />
          <Text>{item.title}</Text>
        </View>
      )}
      keyExtractor={(item) => item.id}
    />
  );
};


optimizeItemArrangement prop
optimizeItemArrangement?: boolean;

When enabled with masonry layout, this will try to reduce differences in column height by modifying item order. Default is true.

Migration from v1
If you're migrating from v1's MasonryFlashList, here are the key changes:

Use FlashList with masonry prop instead of MasonryFlashList
overrideItemLayout no longer needs size estimates - only use it for setting layout.span
getColumnFlex is not supported in v2 masonry layout
Item heights are determined by actual rendered component rather than estimates

React Native Reanimated
React Native Reanimated is an alternative animation library to the LayoutAnimation API provided by React Native.

We support view animations and most of layout animations.

Layout Animations
For layout animations, similarly to the React Native API, you need to call prepareLayoutAnimationRender() before removing or inserting an element that you want to animate.

Hooks
Usage
You can use hooks such as useSharedValue as you would in a normal view. The difference is that since views get recycled, a value can transfer to an unrelated component. You will need to reset such values when a view is recycled - for this, you can pass a prop that uniquely identifies the cell (such as id of an item) and run a callback via useEffect. You can take inspiration from the following example:

import React, { useEffect } from "react";
import Animated, { useSharedValue } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";

const Item = ({ item }: { item: { id: string } }) => {
  const myValue = useSharedValue(0);
  useEffect(() => {
    // Reset value when id changes (view was recycled for another item)
    myValue.value = 0;
  }, [item.id, myValue]);
  return <Animated.View />;
};

const MyList = () => {
  return <FlashList renderItem={Item} />;
};

Performance
If you use hooks that accept a dependencies array, make sure to leverage it and include only the minimal set of dependencies.

SectionList
React Native has a convenience component on top of FlatList, called SectionList. This component has some additional props:

sections
renderSectionFooter
renderSectionHeader
SectionSeparatorComponent
stickySectionHeadersEnabled
FlashList offers none of these props but all of them are replaceable with existing props.

The difficulty of migrating from SectionList to FlashList will depend on the data you have at hand - the data may be more suitable for SectionList, requiring you to massage the data, but the opposite can be true as well. In that case, using FlashList instead of SectionList might even result in less code.

Let's go through how to migrate from SectionList to FlashList in the following example - a contacts list.

This is how we could write such a list with SectionList:

import React from "react";
import { SectionList, StyleSheet, Text } from "react-native";

interface Contact {
  firstName: string;
  lastName: string;
}

interface Section {
  title: string;
  data: Contact[];
}

const contacts: Section[] = [
  { title: "A", data: [{ firstName: "John", lastName: "Aaron" }] },
  {
    title: "D",
    data: [
      { firstName: "John", lastName: "Doe" },
      { firstName: "Mary", lastName: "Dianne" },
    ],
  },
];

const ContactsSectionList = () => {
  return (
    <SectionList
      sections={contacts}
      renderItem={({ item }) => {
        return <Text>{item.firstName}</Text>;
      }}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.header}>{title}</Text>
      )}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    fontSize: 32,
    backgroundColor: "#fff",
  },
});

To migrate to FlashList, we'd need to first convert the contacts variable to the following:

const contacts: (string | Contact)[] = [
  "A",
  { firstName: "John", lastName: "Aaron" },
  "D",
  { firstName: "John", lastName: "Doe" },
  { firstName: "Mary", lastName: "Dianne" },
];

As you can see, you can add the section item right along with the data. Then in the renderItem, you can distinguish what to render based on the type of the item:

const ContactsFlashList = () => {
  return (
    <FlashList
      data={contacts}
      renderItem={({ item }) => {
        if (typeof item === "string") {
          // Rendering header
          return <Text style={styles.header}>{item}</Text>;
        } else {
          // Render item
          return <Text>{item.firstName}</Text>;
        }
      }}
      getItemType={(item) => {
        // To achieve better performance, specify the type based on the item
        return typeof item === "string" ? "sectionHeader" : "row";
      }}
    />
  );
};

You can follow a similar pattern as for renderItem for the rest of the SectionList's props.

If you want your section headers to be sticky, you will also need to compute the array for stickyHeaderIndices:

const stickyHeaderIndices = contacts
  .map((item, index) => {
    if (typeof item === "string") {
      return index;
    } else {
      return null;
    }
  })
  .filter((item) => item !== null) as number[];

And that's it! Below you can find the whole example for FlashList:

import React from "react";
import { StyleSheet, Text } from "react-native";
import { FlashList } from "@shopify/flash-list";

interface Contact {
  firstName: string;
  lastName: string;
}

const contacts: (string | Contact)[] = [
  "A",
  { firstName: "John", lastName: "Aaron" },
  "D",
  { firstName: "John", lastName: "Doe" },
  { firstName: "Mary", lastName: "Dianne" },
];

const stickyHeaderIndices = contacts
  .map((item, index) => {
    if (typeof item === "string") {
      return index;
    } else {
      return null;
    }
  })
  .filter((item) => item !== null) as number[];

const ContactsFlashList = () => {
  return (
    <FlashList
      data={contacts}
      renderItem={({ item }) => {
        if (typeof item === "string") {
          // Rendering header
          return <Text style={styles.header}>{item}</Text>;
        } else {
          // Render item
          return <Text>{item.firstName}</Text>;
        }
      }}
      stickyHeaderIndices={stickyHeaderIndices}
      getItemType={(item) => {
        // To achieve better performance, specify the type based on the item
        return typeof item === "string" ? "sectionHeader" : "row";
      }}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    fontSize: 32,
    backgroundColor: "#fff",
  },
});

Testing with Jest
By default FlashList will mount all items in the test environment. You can use the following mock to setup measurements to prevent everything from mounting. You can also create your own mock.

Setup
Add the following line to your jest-setup.js file:

require("@shopify/flash-list/jestSetup");

To be sure, check if your jest.config.js file contains:

...
preset: 'react-native',
setupFiles: ['./jest-setup.js'],
...

Example
Here is an example of using @testing-library/react-native:

import React from "react";
import { render } from "@testing-library/react-native";

describe("MyFlashListComponent", () => {
  it("renders items", () => {
    const { getByText } = render(<MyFlashListComponent />);
    const element = getByText("Title of one of the items");
    // Do something with element ...
  });
});

