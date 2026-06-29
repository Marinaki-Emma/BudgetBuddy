import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";
import { getColors, space, radius } from "../theme";
import { sync, isSyncConfigured } from "../sync";
import { getDatabase } from "../db";

const SECTIONS:
  { key: string; title: string; subtitle: string; icon: any; disabled?: boolean }[] = [
  { key: "Accounts",     title: "Accounts",     subtitle: "Manage wallets & cards",  icon: require("../../assets/icons/accounts.png") },
  { key: "Transactions", title: "Transactions", subtitle: "Log income & expenses",   icon: require("../../assets/icons/transactions.png") },
  { key: "Recurring",    title: "Recurring",    subtitle: "Subscriptions & bills",   icon: require("../../assets/icons/recurring.png") },
  { key: "Budgets",      title: "Budgets",      subtitle: "Set monthly limits",      icon: require("../../assets/icons/budgets.png") },
  { key: "Reports",      title: "Reports",      subtitle: "Charts & summaries",      icon: require("../../assets/icons/reports.png") },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { isDark, toggleTheme } = useAppTheme();
  const { currency, setCurrencyCode } = useCurrency();
  const c = getColors(isDark);

  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [syncEnabled, setSyncEnabled]   = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [lastSynced, setLastSynced]     = useState<string | null>(null);
  const [syncStatus, setSyncStatus]     = useState<"idle" | "ok" | "error">("idle");
  const [syncMessage, setSyncMessage]   = useState<string | null>(null);

  useEffect(() => {
    isSyncConfigured().then(setSyncEnabled);
    loadLastSynced();
  }, []);

  async function loadLastSynced() {
    try {
      const db = getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM local_meta WHERE key = 'last_synced_at'"
      );
      setLastSynced(row?.value ?? null);
    } catch {}
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus("idle");
    setSyncMessage(null);
    try {
      const result = await sync();
      setSyncStatus("ok");
      setSyncMessage(`↑ ${result.pushed} pushed · ↓ ${result.pulled} pulled`);
      await loadLastSynced();
    } catch (e) {
      setSyncStatus("error");
      setSyncMessage((e as Error).message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function formatLastSynced(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: space.xl }}>

      {/* Header row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.appName, { color: c.text }]}>BudgetBuddy</Text>
          <Text style={[styles.subtitle, { color: c.muted }]}>Your personal finance tracker</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setCurrencyPickerVisible(true)}
            style={[styles.currencyPill, { backgroundColor: c.elevated, borderColor: c.border }]}>
            <Text style={[styles.currencySymbol, { color: c.accent }]}>{currency.symbol}</Text>
            <Text style={[styles.currencyCode, { color: c.muted }]}>{currency.code} ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: c.elevated, borderColor: c.border }]}>
            <Image
              source={isDark
                ? require("../../assets/icons/sun.png")
                : require("../../assets/icons/moon.png")}
              style={styles.themeIcon}
              tintColor={c.accent}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Currency picker modal */}
      <Modal visible={currencyPickerVisible} animationType="fade" transparent
        onRequestClose={() => setCurrencyPickerVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setCurrencyPickerVisible(false)}>
          <Pressable style={[styles.currencySheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Currency</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {CURRENCIES.map((cur) => {
                const selected = cur.code === currency.code;
                return (
                  <TouchableOpacity key={cur.code}
                    style={[styles.currencyRow, { borderBottomColor: c.borderFaint },
                            selected && { backgroundColor: c.accentDim }]}
                    onPress={() => { setCurrencyCode(cur.code); setCurrencyPickerVisible(false); }}>
                    <Text style={[styles.rowSymbol, { color: selected ? c.textAccent : c.text }]}>{cur.symbol}</Text>
                    <Text style={[styles.rowName, { color: selected ? c.textAccent : c.text }]}>{cur.name}</Text>
                    <Text style={[styles.rowCode, { color: c.muted }]}>{cur.code}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sync bar — only shown when sync is configured */}
      {syncEnabled && (
        <View style={[styles.syncBar, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
          <View style={styles.syncLeft}>
            {lastSynced ? (
              <Text style={[styles.syncTime, { color: c.muted }]}>
                Last synced: {formatLastSynced(lastSynced)}
              </Text>
            ) : (
              <Text style={[styles.syncTime, { color: c.muted }]}>Never synced</Text>
            )}
            {syncMessage && (
              <Text style={[styles.syncMsg, { color: syncStatus === "error" ? c.negative : c.positive }]}>
                {syncMessage}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: c.elevated, borderColor: c.border },
                    syncing && { opacity: 0.6 }]}
            onPress={handleSync} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color={c.accent} />
              : <Text style={[styles.syncBtnText, { color: c.accent }]}>⟳ Sync</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Section cards */}
      <View style={styles.grid}>
        {SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderFaint },
                    section.disabled && { opacity: 0.45 }]}
            onPress={() => !section.disabled && navigation.navigate(section.key)}
            activeOpacity={section.disabled ? 1 : 0.7}
          >
            <Image
              source={section.icon}
              style={styles.cardIcon}
              tintColor={section.disabled ? c.muted : c.accent}
              resizeMode="contain"
            />
            <Text style={[styles.cardTitle, { color: c.text }]}>{section.title}</Text>
            <Text style={[styles.cardSubtitle, { color: c.muted }]}>{section.subtitle}</Text>
            {section.disabled && (
              <View style={[styles.soonBadge, { backgroundColor: c.elevated }]}>
                <Text style={[styles.soonText, { color: c.muted }]}>Soon</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: space.lg },
  appName:     { fontSize: 32, fontWeight: "700", letterSpacing: -1, marginBottom: space.xs },
  subtitle:    { fontSize: 15 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  currencyPill:  { flexDirection: "row", alignItems: "center", gap: space.xs, height: 44, paddingHorizontal: space.md, borderRadius: radius.full, borderWidth: 1 },
  currencySymbol:{ fontSize: 18, fontWeight: "700" },
  currencyCode:  { fontSize: 12, fontWeight: "600" },
  themeToggle: { width: 44, height: 44, borderRadius: radius.full, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  themeIcon:   { width: 22, height: 22, resizeMode: "contain" },
  overlay:       { flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: "rgba(0,0,0,0.6)" },
  currencySheet: { borderRadius: radius.lg, padding: space.lg, maxHeight: "80%" },
  sheetTitle:    { fontSize: 20, fontWeight: "700", marginBottom: space.md },
  currencyRow:   { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: 1, borderRadius: radius.sm },
  rowSymbol:     { fontSize: 18, fontWeight: "700", width: 32 },
  rowName:       { fontSize: 15, fontWeight: "500", flex: 1 },
  rowCode:       { fontSize: 13, fontWeight: "600" },
  syncBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.md, padding: space.md, marginBottom: space.lg, borderWidth: 1 },
  syncLeft:    { flex: 1, marginRight: space.md },
  syncTime:    { fontSize: 12 },
  syncMsg:     { fontSize: 12, fontWeight: "600", marginTop: 2 },
  syncBtn:     { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, minWidth: 70, alignItems: "center" },
  syncBtnText: { fontSize: 13, fontWeight: "700" },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  card:        { borderRadius: radius.lg, padding: space.lg, width: "47%", borderWidth: 1 },
  cardIcon:    { width: 36, height: 36, resizeMode: "contain", marginBottom: space.sm },
  cardTitle:   { fontSize: 16, fontWeight: "700", marginBottom: space.xs },
  cardSubtitle:{ fontSize: 12, lineHeight: 17 },
  soonBadge:   { marginTop: space.sm, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 3, alignSelf: "flex-start" },
  soonText:    { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
});