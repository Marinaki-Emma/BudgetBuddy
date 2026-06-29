import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

// On web, flex-based scrolling only works if the document root has a
// definite height. Without this, ScrollViews/FlatLists grow to fit their
// content and the page clips instead of scrolling.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  // Pin the app root to the viewport so it has a *definite* height. Flex-based
  // scrolling (ScrollView/FlatList) only works when an ancestor has a real
  // height; `height: 100%` collapses if a parent is auto-height, so we use
  // position:fixed + inset:0 which always resolves to the viewport size.
  style.textContent =
    "html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }" +
    "#root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; display: flex; flex-direction: column; }" +
    // Flex children default to `min-height: auto`, which makes wrapper divs grow
    // to fit their content instead of shrinking to the height they're given —
    // that stops nested ScrollViews/FlatLists from ever scrolling. Forcing
    // min-height: 0 lets the flex chain bound the list so it scrolls internally.
    "#root div { min-height: 0; }";
  document.head.appendChild(style);
}
import { initDatabase } from "./src/db";
import { removeTestAccount } from "./src/db/accounts";
import { ThemeProvider, useAppTheme } from "./src/context/ThemeContext";
import { CurrencyProvider } from "./src/context/CurrencyContext";
import HomeScreen from "./src/screens/HomeScreen";
import AccountsScreen from "./src/screens/AccountsScreen";
import AccountDetailScreen from "./src/screens/AccountDetailScreen";
import TransactionsScreen from "./src/screens/TransactionsScreen";
import RecurringScreen from "./src/screens/RecurringScreen";
import BudgetsScreen from "./src/screens/BudgetsScreen";
import BudgetAllocationScreen from "./src/screens/BudgetAllocationScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import HomeButton from "./src/components/HomeButton";



const Stack = createStackNavigator();

function AppNavigator() {
  const { theme, isDark } = useAppTheme();
  const bg   = isDark ? "#111110" : "#F5F0EB";
  const text = isDark ? "#E8E6E0" : "#2D2A26";

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{
          headerStyle: { backgroundColor: bg },
          headerTintColor: text,
          headerTitleStyle: { fontWeight: "700" },
          cardStyle: { backgroundColor: bg, flex: 1 },
          headerShadowVisible: false,
          headerRight: () => <HomeButton />,
        }}>
          <Stack.Screen name="Home"          component={HomeScreen}          options={{ headerShown: false }} />
          <Stack.Screen name="Accounts"      component={AccountsScreen}      options={{ title: "" }} />
          <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: "" }} />
          <Stack.Screen name="Transactions"  component={TransactionsScreen}  options={{ title: "" }} />
          <Stack.Screen name="Recurring"     component={RecurringScreen}     options={{ title: "" }} />
          <Stack.Screen name="Budgets"          component={BudgetsScreen}           options={{ title: "" }} />
          <Stack.Screen name="BudgetAllocation" component={BudgetAllocationScreen}  options={{ title: "Allocate budget" }} />
          <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: "" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      await initDatabase();
      await removeTestAccount();
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: "#111110", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#C8A86A" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <AppNavigator />
          </CurrencyProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}