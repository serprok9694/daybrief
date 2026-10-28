import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { gridColumns } from './format';

export interface CardGridProps {
  /** Narrowest column, the `min()` of `minmax(min(<min>px, 100%), 1fr)`. */
  min: number;
  gap: number;
  children: ReactNode[];
}

/** `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))`, with cards of one row at equal height. */
export function CardGrid({ min, gap, children }: CardGridProps) {
  const [width, setWidth] = useState(0);
  const { itemWidth } = gridColumns(width, min, gap);
  return (
    <View
      className="flex-row flex-wrap"
      style={{ gap }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {children.map((child, i) => (
        // Floored so sub-pixel widths never push the last card to the next row.
        <View key={i} className="flex-row" style={{ width: Math.floor(itemWidth) || '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}
