import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { getColors, space, radius } from "../theme";
import { getAccounts, createAccount, deleteAccount, Account } from "../db/accounts";
import AccountTypeIcon from "../components/AccountTypeIcon";

const TYPE_META: Record<Account["type"], { label: string }> = {
  cash:    { label: "Cash" },
  card:    { label: "Card" },
  bank:    { label: "Bank" },
  savings: { label: "Savings" },
  other:   { label: "Other" },
};

const ACCOUNT_TYPES: Account["type"][] = ["cash", "card", "bank", "savings", "other"];

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const c = getColors(isDark);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName]                 = useState("");
  const [type, setType]                 = useState<Account["type"]>("card");
  const [startingBalance, setStartingBalance] = useState("0");
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useFocusEffect(useCallback(() => { loadAccounts(); }, []));

  async function loadAccounts() {
    setLoading(true);
    try { setAccounts(await getAccounts()); }
    finally { setLoading(false); }
  }

  function openModal() {
    setName(""); setType("card"); setStartingBalance("0"); setExcludeFromTotal(false); setError(null);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Account name is required."); return; }
    const balance = parseFloat(startingBalance);
    if (isNaN(balance)) { setError("Starting balance must be a number."); return; }
    setSaving(true);
    try {
      await createAccount({ name: name.trim(), type, currency: "EUR", starting_balance: balance, exclude_from_total: excludeFromTotal });
      setModalVisible(false);
      await loadAccounts();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await deleteAccount(id); await loadAccounts();
  }

  function formatBalance(amount: number): string {
    return `${amount < 0 ? "-" : ""}${symbol}${Math.abs(amount).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

const totalBalance = accounts
  .filter((a) => !a.exclude_from_total)
  .reduce((sum, a) => sum + (a.balance ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: space.md, paddingTop: space.lg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Accounts</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={openModal}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Total balance */}
      {!loading && accounts.length > 0 && (
        <View style={[s.totalCard, { backgroundColor: c.surface, borderColor: c.accentDim }]}>
          <Text style={[s.totalLabel, { color: c.muted }]}>Total balance</Text>
          <Text style={[s.totalAmount, { color: c.text }]}>{formatBalance(totalBalance)}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
      ) : accounts.length === 0 ? (
        <View style={s.empty}>
          <Image source={require("../../assets/icons/accounts.png")}
            style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
          <Text style={[s.emptyTitle, { color: c.text }]}>No accounts yet</Text>
          <Text style={[s.emptySubtitle, { color: c.muted }]}>Add an account to start tracking.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: space.xl }}
          renderItem={({ item }) => (
            <AccountCard
              account={item}
              c={c}
              onDelete={() => handleDelete(item.id)}
              onPress={() => navigation.navigate("AccountDetail", { accountId: item.id })}
              formatBalance={formatBalance}
            />
          )}
        />
      )}

      {/* Add Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>New account</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.fieldLabel, { color: c.muted }]}>Name</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="e.g. Eurobank, Cash wallet" placeholderTextColor={c.muted}
                value={name} onChangeText={setName} autoFocus />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Type</Text>
              <View style={s.typeRow}>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity key={t}
                    style={[s.typeChip, { backgroundColor: c.elevated, borderColor: type === t ? c.accent : c.border },
                            type === t && { backgroundColor: c.accentDim }]}
                    onPress={() => setType(t)}>
                    <AccountTypeIcon type={t} size={14} color={type === t ? c.textAccent : c.muted} />
                    <Text style={[s.typeChipLabel, { color: type === t ? c.textAccent : c.muted }]}>
                      {TYPE_META[t].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: c.muted }]}>Starting balance ({symbol})</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="0.00" placeholderTextColor={c.muted}
                value={startingBalance} onChangeText={setStartingBalance} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Options</Text>
              <TouchableOpacity
                style={[s.optionChip, { backgroundColor: c.elevated, borderColor: !excludeFromTotal ? c.accent : c.border },
                        !excludeFromTotal && { backgroundColor: c.accentDim }]}
                onPress={() => setExcludeFromTotal((v) => !v)}>
                <Text style={[s.optionChipText, { color: !excludeFromTotal ? c.textAccent : c.muted }]}>
                  {!excludeFromTotal ? "✓ Included in total" : "Excluded from total"}
                </Text>
              </TouchableOpacity>

              {error && <Text style={[s.errorText, { color: c.negative }]}>{error}</Text>}

              <View style={s.actions}>
                <Pressable style={[s.cancelBtn, { backgroundColor: c.elevated }]} onPress={() => setModalVisible(false)}>
                  <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.saveBtn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]}
                  onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" />
                           : <Text style={s.saveBtnText}>Save account</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function AccountCard({ account, c, onDelete, onPress, formatBalance }: {
  account: Account;
  c: ReturnType<typeof getColors>;
  onDelete: () => void;
  onPress: () => void;
  formatBalance: (n: number) => string;
}) {
  const meta = TYPE_META[account.type];
  const balance = account.balance ?? 0;

  return (
    <TouchableOpacity style={[cs.card, { backgroundColor: c.surface, borderColor: c.borderFaint }]}
      onPress={onPress} activeOpacity={0.7}>
      <View style={cs.left}>
        <View style={[cs.iconWrap, { backgroundColor: c.elevated }]}>
          <AccountTypeIcon type={account.type} size={22} color={c.accent} />
        </View>
        <View>
          <Text style={[cs.name, { color: c.text }]}>{account.name}</Text>
          <Text style={[cs.type, { color: c.muted }]}>{meta.label}</Text>
          {account.exclude_from_total === 1 && (
            <Text style={{ fontSize: 10, color: c.muted }}>Excl. from total</Text>
          )}
        </View>
      </View>
      <View style={cs.right}>
        <Text style={[cs.balance, { color: balance < 0 ? c.negative : c.positive }]}>
          {formatBalance(balance)}
        </Text>
        <TouchableOpacity onPress={onDelete} hitSlop={12}>
          <Text style={[cs.deleteBtn, { color: c.muted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg },
  title:        { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  addBtn:       { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full },
  addBtnText:   { color: "#fff", fontWeight: "600", fontSize: 14 },
  totalCard:    { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg, borderWidth: 1 },
  totalLabel:   { fontSize: 13, marginBottom: space.xs, textTransform: "uppercase", letterSpacing: 1 },
  totalAmount:  { fontSize: 36, fontWeight: "700", letterSpacing: -1 },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space.xxl },
  emptyIcon:    { fontSize: 48, marginBottom: space.md },
  emptyIconImg: { width: 64, height: 64, marginBottom: space.md },
  emptyTitle:   { fontSize: 18, fontWeight: "600", marginBottom: space.sm },
  emptySubtitle:{ fontSize: 14, textAlign: "center" },
  overlay:      { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:        { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl, maxHeight: "85%" },
  handle:       { width: 40, height: 4, borderRadius: radius.full, alignSelf: "center", marginBottom: space.lg },
  sheetTitle:   { fontSize: 20, fontWeight: "700", marginBottom: space.lg },
  fieldLabel:   { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: space.sm, marginTop: space.md },
  input:        { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  typeRow:      { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  typeChip:     { flexDirection: "row", alignItems: "center", gap: space.xs, borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1 },
  typeChipIcon: { fontSize: 14 },
  typeChipLabel:{ fontSize: 13, fontWeight: "500" },
  optionChip:    { borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1, flexDirection: "row", justifyContent: "center", gap: 4 },
  optionChipText:{ fontSize: 12, fontWeight: "600" },
  errorText:    { fontSize: 13, marginTop: space.sm },
  actions:      { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  cancelBtn:    { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  cancelBtnText:{ fontWeight: "600", fontSize: 15 },
  saveBtn:      { flex: 2, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const cs = StyleSheet.create({
  card:     { borderRadius: radius.md, padding: space.md, marginBottom: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1 },
  left:     { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  icon:     { fontSize: 20 },
  name:     { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  type:     { fontSize: 12 },
  right:    { alignItems: "flex-end", gap: space.xs },
  balance:  { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  deleteBtn:{ fontSize: 12, paddingTop: 2 },
});