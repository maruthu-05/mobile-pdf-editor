import React from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLoader height={120} borderRadius={8} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <SkeletonLoader height={16} width="80%" style={styles.cardTitle} />
        <SkeletonLoader height={12} width="60%" style={styles.cardSubtitle} />
        <View style={styles.cardFooter}>
          <SkeletonLoader height={10} width="40%" />
          <SkeletonLoader height={10} width="30%" />
        </View>
      </View>
    </View>
  );
};

export const SkeletonList: React.FC<{
  itemCount?: number;
  itemHeight?: number;
  style?: ViewStyle;
}> = ({ itemCount = 5, itemHeight = 60, style }) => {
  return (
    <View style={[styles.list, style]}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <View key={index} style={[styles.listItem, { height: itemHeight }]}>
          <SkeletonLoader
            width={40}
            height={40}
            borderRadius={20}
            style={styles.listItemIcon}
          />
          <View style={styles.listItemContent}>
            <SkeletonLoader height={14} width="70%" style={styles.listItemTitle} />
            <SkeletonLoader height={10} width="50%" style={styles.listItemSubtitle} />
          </View>
          <SkeletonLoader width={60} height={12} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonGrid: React.FC<{
  columns?: number;
  itemCount?: number;
  itemAspectRatio?: number;
  style?: ViewStyle;
}> = ({ columns = 2, itemCount = 6, itemAspectRatio = 1, style }) => {
  const itemWidth = `${(100 / columns) - 2}%`;

  return (
    <View style={[styles.grid, style]}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.gridItem,
            {
              width: itemWidth,
              aspectRatio: itemAspectRatio,
            },
          ]}
        >
          <SkeletonLoader width="100%" height="100%" borderRadius={8} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: string;
  style?: ViewStyle;
}> = ({ lines = 3, lineHeight = 16, lastLineWidth = '60%', style }) => {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          style={[styles.textLine, { marginBottom: index < lines - 1 ? 8 : 0 }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    marginBottom: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardSubtitle: {
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemIcon: {
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    marginBottom: 4,
  },
  listItemSubtitle: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  gridItem: {
    marginBottom: 16,
  },
  textContainer: {
    flex: 1,
  },
  textLine: {},
});