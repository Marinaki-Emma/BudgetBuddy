import { TouchableOpacity, Image, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { getColors, space } from "../theme";

/**
 * A small icon + "Home" label shown in the header of every screen,
 * tapping it returns to the Home screen.
 */
export default function HomeButton() {
  const navigation = useNavigation<any>();
  const { isDark } = useAppTheme();
  const c = getColors(isDark);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Home")}
      style={styles.btn}
      hitSlop={8}
      activeOpacity={0.7}
    >
      <Image
        source={require("../../assets/icons/home.png")}
        style={styles.icon}
        tintColor={c.accent}
        resizeMode="contain"
      />
      <Text style={[styles.label, { color: c.accent }]}>Home</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:   { alignItems: "center", justifyContent: "center", marginRight: space.md },
  icon:  { width: 22, height: 22 },
  label: { fontSize: 10, fontWeight: "600", marginTop: 2 },
});
