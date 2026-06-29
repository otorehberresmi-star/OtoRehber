import Colors from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

type PhotoCarouselProps = {
  images?: Array<string | null | undefined>;
  height?: number;
  style?: ViewStyle;
  maxImages?: number;
  onRemoveImage?: (index: number) => void;
};

export default function PhotoCarousel({
  images,
  height = 240,
  style,
  maxImages = 5,
  onRemoveImage,
}: PhotoCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const displayImages = useMemo(
    () => (images || []).filter(Boolean).slice(0, maxImages) as string[],
    [images, maxImages],
  );

  if (displayImages.length === 0) return null;

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!containerWidth) return;
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / containerWidth,
    );
    setActiveIndex(Math.max(0, Math.min(nextIndex, displayImages.length - 1)));
  };

  return (
    <View
      style={[styles.container, { height }, style]}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.scroller}
      >
        {displayImages.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            source={{ uri }}
            style={[
              styles.image,
              {
                width: containerWidth || 1,
                height,
              },
            ]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {onRemoveImage ? (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveImage(activeIndex)}
          activeOpacity={0.85}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      ) : null}

      {displayImages.length > 1 ? (
        <>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {activeIndex + 1}/{displayImages.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {displayImages.map((_, index) => (
              <View
                key={`photo-dot-${index}`}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.navyBorder,
  },
  scroller: { flex: 1 },
  image: {
    backgroundColor: Colors.navyBorder,
  },
  removeButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: Colors.white,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  counterBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  counterText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.white,
  },
});
