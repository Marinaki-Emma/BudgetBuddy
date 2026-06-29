import { Image, ImageSourcePropType, ImageStyle, StyleProp } from "react-native";
import type { Account } from "../db/accounts";

/**
 * Monochrome PNG icon for each account type. The PNGs are black line-art on a
 * transparent background, so a `color` (tint) should always be passed.
 */
const ICONS: Record<Account["type"], ImageSourcePropType> = {
  cash:    require("../../assets/icons/cash.png"),
  card:    require("../../assets/icons/card.png"),
  bank:    require("../../assets/icons/bank.png"),
  savings: require("../../assets/icons/savings.png"),
  other:   require("../../assets/icons/other.png"),
};

export default function AccountTypeIcon({ type, size = 20, color, style }: {
  type: Account["type"] | string | null | undefined;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const source = ICONS[type as Account["type"]] ?? ICONS.other;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      tintColor={color}
      resizeMode="contain"
    />
  );
}
