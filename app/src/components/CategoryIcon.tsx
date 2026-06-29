import { Image, ImageSourcePropType, ImageStyle, StyleProp, Text } from "react-native";

/**
 * Monochrome PNG icon for the seeded expense categories, keyed by name.
 * Categories without a matching PNG (e.g. income categories, user emojis)
 * fall back to their stored emoji string.
 */
const CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  "Food & Drink":  require("../../assets/icons/food_drink.png"),
  "Groceries":     require("../../assets/icons/groceries.png"),
  "Transport":     require("../../assets/icons/transport.png"),
  "Housing":       require("../../assets/icons/housing.png"),
  "Utilities":     require("../../assets/icons/utilities.png"),
  "Health":        require("../../assets/icons/health.png"),
  "Shopping":      require("../../assets/icons/shopping.png"),
  "Entertainment": require("../../assets/icons/entertainment.png"),
  "Subscriptions": require("../../assets/icons/subscriptions.png"),
  "Education":     require("../../assets/icons/education.png"),
  "Other":         require("../../assets/icons/other2.png"),
  // Income categories
  "Salary":        require("../../assets/icons/salary.png"),
  "Freelance":     require("../../assets/icons/freelance.png"),
  "Gift":          require("../../assets/icons/gift.png"),
  "Other Income":  require("../../assets/icons/income.png"),
};

export default function CategoryIcon({ name, emoji, size = 20, color, style }: {
  name?: string | null;
  emoji?: string | null;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const source = name ? CATEGORY_ICONS[name] : undefined;
  if (source) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        tintColor={color}
        resizeMode="contain"
      />
    );
  }
  // No PNG for this category — render the stored emoji if there is one.
  if (emoji) {
    return <Text style={{ fontSize: size }}>{emoji}</Text>;
  }
  // Final fallback — no PNG and no emoji.
  return (
    <Image
      source={require("../../assets/icons/other2.png")}
      style={[{ width: size, height: size }, style]}
      tintColor={color}
      resizeMode="contain"
    />
  );
}
