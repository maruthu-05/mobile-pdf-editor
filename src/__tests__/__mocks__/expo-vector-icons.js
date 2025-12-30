// Mock for @expo/vector-icons
import React from 'react';

const MockIcon = ({ name, size, color, ...props }) => {
  return React.createElement('Text', {
    ...props,
    testID: `icon-${name}`,
    children: name,
  });
};

export const Ionicons = MockIcon;
export const MaterialIcons = MockIcon;
export const FontAwesome = MockIcon;
export const AntDesign = MockIcon;
export const Entypo = MockIcon;
export const EvilIcons = MockIcon;
export const Feather = MockIcon;
export const Foundation = MockIcon;
export const MaterialCommunityIcons = MockIcon;
export const Octicons = MockIcon;
export const SimpleLineIcons = MockIcon;
export const Zocial = MockIcon;