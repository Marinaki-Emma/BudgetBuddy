import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { getColors, space, radius } from "../theme";
import { getAccountById, updateAccount, deleteAccount, Account } from "../db/accounts";
import { getTransactionsByAccount, createTransaction, deleteTransaction,
         getCategories, seedCategoriesIfEmpty,
         Transaction, TransactionGroup, Category } from "../db/transactions";
import { getAccounts } from "../db/accounts";
import AccountTypeIcon from "../components/AccountTypeIcon";
import CategoryIcon from "../components/CategoryIcon";

const TYPE_META: Record<Account["type"], { label: string }> = {
  cash:    { label: "Cash" },
  bank:    { label: "Bank" },
  card:    { label: "Card" },
  savings: { label: "Savings" },
  other:   { label: "Other" },
};
const ACCOUNT_TYPES: Account["type"][] = ["cash", "bank", "card", "savings", "other"];
type TxType = "expense" | "income" | "transfer";

export default function AccountDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { accountId } = route.params as { accountId: string };
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const c = getColors(isDark);

  const [account, setAccount]         = useState<Account | null>(null);
  const [groups, setGroups]           = useState<TransactionGroup[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loading, setLoading]         = useState(true);

  // Add transaction state
  const [addVisible, setAddVisible]   = useState(false);
  const [txType, setTxType]           = useState<TxType>("expense");
  const [amount, setAmount]           = useState("");
  const [categoryId, setCategoryId]   = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate]               = useState(todayString());
  const [note, setNote]               = useState("");
  const [saving, setSaving]           = useState(false);
  const [addError, setAddError]       = useState<string | null>(null);

  // Edit account state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName]       = useState("");
  const [editType, setEditType]       = useState<Account["type"]>("other");
  const [editExclude, setEditExclude] = useState(false);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("0");

  useFocusEffect(useCallback(() => { load(); }, [accountId]));

  async function load() {
    setLoading(true);
    try {
      await seedCategoriesIfEmpty();
      const [acct, txGroups, cats, accts] = await Promise.all([
        getAccountById(accountId),
        getTransactionsByAccount(accountId),
        getCategories(),
        getAccounts(),
      ]);
      setAccount(acct);
      setGroups(txGroups);
      setCategories(cats);
      setAllAccounts(accts);
      if (acct) navigation.setOptions({ title: acct.name });
    } finally { setLoading(false); }
  }

  function openAdd() {
    setTxType("expense"); setAmount(""); setCategoryId(null);
    setToAccountId(null); setDate(todayString()); setNote(""); setAddError(null);
    setAddVisible(true);
  }

  async function handleAdd() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setAddError("Enter a valid amount."); return; }
    if (txType !== "transfer" && !categoryId) { setAddError("Select a category."); return; }
    if (txType === "transfer" && !toAccountId) { setAddError("Select a destination account."); return; }
    if (txType === "transfer" && toAccountId === accountId) { setAddError("From and To must differ."); return; }
    setSaving(true);
    try {
      await createTransaction({
        type: txType,
        account_id:      txType !== "transfer" ? accountId : undefined,
        from_account_id: txType === "transfer"  ? accountId : undefined,
        to_account_id:   txType === "transfer"  ? (toAccountId ?? undefined) : undefined,
        category_id: categoryId ?? undefined,
        amount: parsed, occurred_at: date,
        note: note.trim() || undefined,
      });
      setAddVisible(false); await load();
    } catch { setAddError("Failed to save."); }
    finally { setSaving(false); }
  }

  function openEdit() {
    if (!account) return;
    setEditName(account.name);
    setEditType(account.type);
    setEditExclude(account.exclude_from_total === 1);
    setEditError(null);
    setEditVisible(true);
    setEditBalance(String(account.starting_balance));
  }

  async function handleEdit() {
    if (!editName.trim()) { setEditError("Name is required."); return; }
    setEditSaving(true);
    try {
      await updateAccount(accountId, { 
        name: editName.trim(), 
        type: editType, 
        exclude_from_total: editExclude,
        starting_balance: parseFloat(editBalance) || 0
      });
      setEditVisible(false); await load();
    } catch { setEditError("Failed to save."); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    Alert.alert("Delete account", `Delete "${account?.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteAccount(accountId); navigation.goBack(); } },
    ]);
  }

  if (loading) return <View style={[s.centered, { backgroundColor: c.bg }]}><ActivityIndicator color={c.accent} /></View>;
  if (!account) return <View style={[s.centered, { backgroundColor: c.bg }]}><Text style={{ color: c.muted }}>Account not found.</Text></View>;

  const meta    = TYPE_META[account.type];
  const balance = account.balance ?? 0;
  const filteredCats = categories.filter((cat) => txType === "transfer" || cat.kind === txType);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: space.md, paddingTop: space.md }}>
      {/* Summary card */}
      <View style={[s.summaryCard, { backgroundColor: c.surface, borderColor: c.accentDim }]}>
        <View style={s.summaryTop}>
          <View style={s.summaryLeft}>
            <AccountTypeIcon type={account.type} size={28} color={c.accent} style={{ marginRight: space.xs }} />
            <View>
              <Text style={[s.accountName, { color: c.text }]}>{account.name}</Text>
              <Text style={[s.accountType, { color: c.muted }]}>
                {meta.label}{account.exclude_from_total === 1 ? " · Excl. from total" : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[s.editBtn, { backgroundColor: c.elevated, borderColor: c.border }]} onPress={openEdit}>
            <Text style={[s.editBtnText, { color: c.muted }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.balanceLabel, { color: c.muted }]}>Current balance</Text>
        <Text style={[s.balanceAmount, { color: balance < 0 ? c.negative : c.positive }]}>
          {balance < 0 ? "-" : ""}{symbol}{Math.abs(balance).toFixed(2)}
        </Text>
        <TouchableOpacity style={[s.addTxBtn, { backgroundColor: c.accent }]} onPress={openAdd}>
          <Text style={s.addTxBtnText}>+ Add transaction</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.sectionTitle, { color: c.muted }]}>Transactions</Text>

      {groups.length === 0 ? (
        <View style={s.empty}>
          <Image source={require("../../assets/icons/cash.png")}
            style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
          <Text style={[s.emptyTitle, { color: c.text }]}>No transactions yet</Text>
          <Text style={[s.emptySubtitle, { color: c.muted }]}>Tap "+ Add transaction" to log one.</Text>
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={groups.map((g) => ({ title: g.label, total: g.total, data: g.transactions }))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: space.xxl }}
          renderSectionHeader={({ section }) => (
            <View style={s.dayHeader}>
              <Text style={[s.dayLabel, { color: c.muted }]}>{section.title}</Text>
              <Text style={[s.dayTotal, { color: section.total >= 0 ? c.positive : c.negative }]}>
                {section.total >= 0 ? "+" : ""}{symbol}{Math.abs(section.total).toFixed(2)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TxRow transaction={item} accountId={accountId} c={c}
              onDelete={() => deleteTransaction(item.id).then(load)} />
          )}
        />
      )}

      {/* Add Transaction Modal */}
      <Modal visible={addVisible} animationType="slide" transparent onRequestClose={() => setAddVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>New transaction</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type */}
              <View style={s.typeRow}>
                {(["expense", "income", "transfer"] as TxType[]).map((t) => (
                  <TouchableOpacity key={t}
                    style={[s.typeChip, { backgroundColor: c.elevated, borderColor: c.border },
                      txType === t && t === "expense"  && { borderColor: c.negative },
                      txType === t && t === "income"   && { borderColor: c.positive },
                      txType === t && t === "transfer" && { borderColor: c.accent },
                    ]}
                    onPress={() => setTxType(t)}>
                    <Text style={[s.typeChipText, { color: c.muted },
                      txType === t && t === "expense"  && { color: c.negative },
                      txType === t && t === "income"   && { color: c.positive },
                      txType === t && t === "transfer" && { color: c.accent },
                    ]}>
                      {t === "expense" ? "− Expense" : t === "income" ? "+ Income" : "⇄ Transfer"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: c.muted }]}>Amount ({symbol})</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="0.00" placeholderTextColor={c.muted} value={amount}
                onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Date</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="YYYY-MM-DD" placeholderTextColor={c.muted} value={date} onChangeText={setDate} />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Note (optional)</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="e.g. groceries run" placeholderTextColor={c.muted} value={note} onChangeText={setNote} />

              {txType !== "transfer" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Category</Text>
                  <View style={s.categoryGrid}>
                    {filteredCats.map((cat) => (
                      <TouchableOpacity key={cat.id}
                        style={[s.categoryChip, { backgroundColor: c.elevated, borderColor: c.border },
                          categoryId === cat.id && { borderColor: cat.color ?? c.accent, backgroundColor: (cat.color ?? c.accent) + "22" }]}
                        onPress={() => setCategoryId(cat.id)}>
                        <CategoryIcon name={cat.name} emoji={cat.icon} size={18} color={cat.color ?? c.accent} />
                        <Text style={[s.catName, { color: categoryId === cat.id ? (cat.color ?? c.accent) : c.muted }]}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {txType === "transfer" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>To account</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.chipRow}>
                      {allAccounts.filter((a) => a.id !== accountId).map((a) => (
                        <TouchableOpacity key={a.id}
                          style={[s.chip, { backgroundColor: c.elevated, borderColor: toAccountId === a.id ? c.accent : c.border },
                                  toAccountId === a.id && { backgroundColor: c.accentDim }]}
                          onPress={() => setToAccountId(a.id)}>
                          <Text style={[s.chipText, { color: toAccountId === a.id ? c.textAccent : c.muted }]}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {addError && <Text style={[s.errorText, { color: c.negative }]}>{addError}</Text>}

              <View style={s.actions}>
                <Pressable style={[s.cancelBtn, { backgroundColor: c.elevated }]} onPress={() => setAddVisible(false)}>
                  <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.saveBtn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]}
                  onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Account Modal */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>Edit account</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.fieldLabel, { color: c.muted }]}>Name</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
               placeholder="Account name" placeholderTextColor={c.muted}
               value={editName} onChangeText={setEditName} />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Starting balance ({symbol})</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
               placeholder="0.00" placeholderTextColor={c.muted}
               value={editBalance} onChangeText={setEditBalance} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Type</Text>
              <View style={s.typeRow}>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity key={t}
                    style={[s.typeChip, { backgroundColor: c.elevated, borderColor: editType === t ? c.accent : c.border },
                            editType === t && { backgroundColor: c.accentDim }]}
                    onPress={() => setEditType(t)}>
                    <AccountTypeIcon type={t} size={14} color={editType === t ? c.textAccent : c.muted} />
                    <Text style={[s.typeChipText, { color: editType === t ? c.textAccent : c.muted }]}>{TYPE_META[t].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: c.muted }]}>Options</Text>
              <TouchableOpacity
                style={[s.typeChip, { backgroundColor: c.elevated, borderColor: !editExclude ? c.accent : c.border },
                        !editExclude && { backgroundColor: c.accentDim }]}
                onPress={() => setEditExclude((v) => !v)}>
                <Text style={[s.typeChipText, { color: !editExclude ? c.textAccent : c.muted }]}>
                  {!editExclude ? "✓ Included in total" : "Excluded from total"}
                </Text>
              </TouchableOpacity>

              {editError && <Text style={[s.errorText, { color: c.negative }]}>{editError}</Text>}

              <View style={s.actions}>
                <Pressable style={[s.cancelBtn, { backgroundColor: c.elevated }]} onPress={() => setEditVisible(false)}>
                  <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.saveBtn, { backgroundColor: c.accent }, editSaving && { opacity: 0.6 }]}
                  onPress={handleEdit} disabled={editSaving}>
                  {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </Pressable>
              </View>

              <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                <Text style={[s.deleteBtnText, { color: c.negative }]}>Delete account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TxRow({ transaction: t, accountId, c, onDelete }: {
  transaction: Transaction; accountId: string;
  c: ReturnType<typeof getColors>; onDelete: () => void;
}) {
  const { symbol } = useCurrency();
  const isIncome   = t.type === "income";
  const isTransfer = t.type === "transfer";
  const isOutgoing = isTransfer && t.from_account_id === accountId;
  const amountColor = isIncome ? c.positive : isTransfer ? c.accent : c.negative;
  const sign = isIncome ? "+" : isOutgoing ? "−" : isTransfer ? "+" : "−";

  return (
    <View style={[rs.row, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
      <View style={[rs.iconWrap, { backgroundColor: c.elevated }]}>
        <CategoryIcon name={t.category_name} emoji={t.category_icon ?? (isTransfer ? "⇄" : undefined)} size={20} color={t.category_color ?? c.text} />
      </View>
      <View style={rs.middle}>
        <Text style={[rs.category, { color: c.text }]}>{t.category_name ?? (isTransfer ? "Transfer" : "Uncategorized")}</Text>
        {t.note ? <Text style={[rs.note, { color: c.muted }]}>{t.note}</Text> : null}
        <Text style={[rs.account, { color: c.muted }]}>{t.account_name ?? ""}</Text>
      </View>
      <View style={rs.right}>
        <Text style={[rs.amount, { color: amountColor }]}>{sign}{symbol}{t.amount.toFixed(2)}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={12}>
          <Text style={[rs.deleteBtn, { color: c.muted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function todayString() { return new Date().toISOString().slice(0, 10); }

const s = StyleSheet.create({
  centered:     { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryCard:  { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg, borderWidth: 1 },
  summaryTop:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.md },
  summaryLeft:  { flexDirection: "row", alignItems: "center", gap: space.md },
  accountIcon:  { fontSize: 28 },
  accountName:  { fontSize: 18, fontWeight: "700" },
  accountType:  { fontSize: 13 },
  editBtn:      { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1 },
  editBtnText:  { fontSize: 13, fontWeight: "600" },
  balanceLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: space.xs },
  balanceAmount:{ fontSize: 36, fontWeight: "700", letterSpacing: -1, marginBottom: space.md },
  addTxBtn:     { borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center" },
  addTxBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: space.sm },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space.xxl },
  emptyIcon:    { fontSize: 40, marginBottom: space.md },
  emptyIconImg: { width: 56, height: 56, marginBottom: space.md },
  emptyTitle:   { fontSize: 17, fontWeight: "600", marginBottom: space.xs },
  emptySubtitle:{ fontSize: 13, textAlign: "center" },
  dayHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: space.sm, marginTop: space.sm },
  dayLabel:     { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  dayTotal:     { fontSize: 13, fontWeight: "600" },
  overlay:      { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:        { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl, maxHeight: "90%" },
  handle:       { width: 40, height: 4, borderRadius: radius.full, alignSelf: "center", marginBottom: space.lg },
  sheetTitle:   { fontSize: 20, fontWeight: "700", marginBottom: space.md },
  typeRow:      { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  typeChip:     { flex: 1, minWidth: "28%", borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1, flexDirection: "row", justifyContent: "center", gap: 4 },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { fontSize: 12, fontWeight: "600" },
  fieldLabel:   { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: space.sm, marginTop: space.md },
  input:        { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  chipRow:      { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  chip:         { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1 },
  chipText:     { fontSize: 13, fontWeight: "500" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: space.xs, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.sm, borderWidth: 1, minWidth: "30%" },
  catIcon:      { fontSize: 16 },
  catName:      { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  errorText:    { fontSize: 13, marginTop: space.sm },
  actions:      { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  cancelBtn:    { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  cancelBtnText:{ fontWeight: "600", fontSize: 15 },
  saveBtn:      { flex: 2, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteBtn:    { marginTop: space.lg, alignItems: "center", paddingVertical: space.md },
  deleteBtnText:{ fontSize: 14, fontWeight: "600" },
});

const rs = StyleSheet.create({
  row:      { borderRadius: radius.md, padding: space.md, marginBottom: space.xs, flexDirection: "row", alignItems: "center", borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginRight: space.md },
  icon:     { fontSize: 18 },
  middle:   { flex: 1 },
  category: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  note:     { fontSize: 12, fontStyle: "italic", marginBottom: 2 },
  account:  { fontSize: 12 },
  right:    { alignItems: "flex-end", gap: space.xs },
  amount:   { fontSize: 16, fontWeight: "700" },
  deleteBtn:{ fontSize: 11 },
});