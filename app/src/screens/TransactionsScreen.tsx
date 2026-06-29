import { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { getColors, space, radius } from "../theme";
import {
  getTransactionsGroupedByDay, getTransactionsGroupedByWeek, getTransactionsGroupedByMonth,
  createTransaction, deleteTransaction,
  getCategories, seedCategoriesIfEmpty,
  Transaction, TransactionGroup, Category,
} from "../db/transactions";
import { getAccounts, Account } from "../db/accounts";
import { getRecurringTemplates, RecurringTemplate } from "../db/recurring";
import CategoryIcon from "../components/CategoryIcon";
import { useCurrency } from "../context/CurrencyContext";

type TxType = "expense" | "income" | "transfer";
type ViewMode = "day" | "week" | "month";

export default function TransactionsScreen() {
  const route = useRoute<any>();
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const c = getColors(isDark);
  const [groups, setGroups]         = useState<TransactionGroup[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [viewMode, setViewMode]     = useState<ViewMode>("day");
  const [modalVisible, setModalVisible] = useState(false);
  const [templates, setTemplates]   = useState<RecurringTemplate[]>([]);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);

  // Form state
  const [txType, setTxType]         = useState<TxType>("expense");
  const [amount, setAmount]         = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId]   = useState<string | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId]     = useState<string | null>(null);
  const [date, setDate]             = useState(todayString());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load().then(() => {
        // Open pre-filled modal if navigated from a recurring reminder
        if (route.params?.prefill) {
          const p = route.params.prefill;
          setTxType(p.type);
          setAmount(String(p.amount));
          setCategoryId(p.category_id ?? null);
          setAccountId(p.account_id ?? null);
          setDate(todayString());
          setError(null);
          setModalVisible(true);
        }
      });
    }, [viewMode, route.params])
  );

  // Also reload when the toggle changes while screen is already focused
  useEffect(() => {
    load();
  }, [viewMode]);

  async function load() {
    setLoading(true);
    try {
      await seedCategoriesIfEmpty();
      const groupFn =
        viewMode === "week"  ? getTransactionsGroupedByWeek :
        viewMode === "month" ? getTransactionsGroupedByMonth :
                               getTransactionsGroupedByDay;
      const [g, a, c, t] = await Promise.all([
        groupFn(),
        getAccounts(),
        getCategories(),
        getRecurringTemplates(),
      ]);
      setGroups(g);
      setAccounts(a);
      setCategories(c);
      setTemplates(t);
      if (a.length > 0 && !accountId) setAccountId(a[0].id);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setTxType("expense");
    setAmount("");
    setCategoryId(null);
    setAccountId(accounts[0]?.id ?? null);
    setFromAccountId(accounts[0]?.id ?? null);
    setToAccountId(accounts[1]?.id ?? null);
    setDate(todayString());
    setError(null);
    setModalVisible(true);
  }

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (txType !== "transfer" && !categoryId) {
      setError("Select a category.");
      return;
    }
    if (txType === "transfer" && fromAccountId === toAccountId) {
      setError("From and To accounts must be different.");
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        type: txType,
        account_id: txType !== "transfer" ? (accountId ?? undefined) : undefined,
        from_account_id: txType === "transfer" ? (fromAccountId ?? undefined) : undefined,
        to_account_id: txType === "transfer" ? (toAccountId ?? undefined) : undefined,
        category_id: categoryId ?? undefined,
        amount: parsed,
        occurred_at: date,
      });
      setModalVisible(false);
      await load();
    } catch (e) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(t: RecurringTemplate) {
    setTxType(t.type);
    setAmount(String(t.amount));
    setCategoryId(t.category_id ?? null);
    setAccountId(t.account_id ?? null);
    setTemplatePickerVisible(false);
  }

  const filteredCategories = categories.filter(
    (cat) => txType === "transfer" || cat.kind === txType
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: space.md, paddingTop: space.lg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Transactions</Text>
        <TouchableOpacity style={[s.addButton, { backgroundColor: c.accent }]} onPress={openModal}>
          <Text style={s.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* View mode toggle */}
      <View style={s.toggleRow}>
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <TouchableOpacity key={mode}
            style={[s.toggleBtn, { backgroundColor: c.surface, borderColor: c.border },
                    viewMode === mode && { borderColor: c.accent, backgroundColor: c.accentDim }]}
            onPress={() => setViewMode(mode)} activeOpacity={0.7}>
            <Text style={[s.toggleBtnText, { color: viewMode === mode ? c.textAccent : c.muted }]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction list */}
      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
      ) : groups.length === 0 ? (
        <View style={s.empty}>
          <Image source={require("../../assets/icons/cash.png")}
            style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
          <Text style={[s.emptyTitle, { color: c.text }]}>No transactions yet</Text>
          <Text style={[s.emptySubtitle, { color: c.muted }]}>Tap "+ Add" to log your first one.</Text>
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={groups.map((g) => ({ title: g.label, total: g.total, data: g.transactions }))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: space.xl }}
          renderSectionHeader={({ section }) => (
            <DayHeader label={section.title} total={section.total} c={c} />
          )}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} c={c} onDelete={() => deleteTransaction(item.id).then(load)} />
          )}
        />
      )}

      {/* Add Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <View style={s.titleRow}>
              <Text style={[s.sheetTitle, { color: c.text }]}>New transaction</Text>
              {templates.length > 0 && (
                <TouchableOpacity style={[s.templateBtn, { backgroundColor: c.elevated, borderColor: c.accent, flexDirection: "row", alignItems: "center", gap: 4 }]}
                  onPress={() => setTemplatePickerVisible(true)}>
                  <Image source={require("../../assets/icons/template.png")}
                    style={{ width: 14, height: 14 }} tintColor={c.textAccent} resizeMode="contain" />
                  <Text style={[s.templateBtnText, { color: c.textAccent }]}>Template</Text>
                </TouchableOpacity>
              )}
            </View>
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

              {txType !== "transfer" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Account</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
                    <View style={s.chipRow}>
                      {accounts.map((a) => (
                        <TouchableOpacity key={a.id}
                          style={[s.chip, { backgroundColor: c.elevated, borderColor: accountId === a.id ? c.accent : c.border },
                                  accountId === a.id && { backgroundColor: c.accentDim }]}
                          onPress={() => setAccountId(a.id)}>
                          <Text style={[s.chipText, { color: accountId === a.id ? c.textAccent : c.muted }]}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {txType === "transfer" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>From</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
                    <View style={s.chipRow}>
                      {accounts.map((a) => (
                        <TouchableOpacity key={a.id}
                          style={[s.chip, { backgroundColor: c.elevated, borderColor: fromAccountId === a.id ? c.accent : c.border },
                                  fromAccountId === a.id && { backgroundColor: c.accentDim }]}
                          onPress={() => setFromAccountId(a.id)}>
                          <Text style={[s.chipText, { color: fromAccountId === a.id ? c.textAccent : c.muted }]}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
                    <View style={s.chipRow}>
                      {accounts.map((a) => (
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

              {txType !== "transfer" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Category</Text>
                  <View style={s.categoryGrid}>
                    {filteredCategories.map((cat) => (
                      <TouchableOpacity key={cat.id}
                        style={[s.categoryChip, { backgroundColor: c.elevated, borderColor: c.border },
                          categoryId === cat.id && { borderColor: cat.color ?? c.accent, backgroundColor: (cat.color ?? c.accent) + "22" }]}
                        onPress={() => setCategoryId(cat.id)}>
                        <CategoryIcon name={cat.name} emoji={cat.icon} size={18} color={cat.color ?? c.accent} />
                        <Text style={[s.categoryName, { color: categoryId === cat.id ? (cat.color ?? c.accent) : c.muted }]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {error && <Text style={[s.errorText, { color: c.negative }]}>{error}</Text>}

              <View style={s.actions}>
                <Pressable style={[s.cancelBtn, { backgroundColor: c.elevated }]} onPress={() => setModalVisible(false)}>
                  <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.saveBtn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]}
                  onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Template Picker Modal */}
      <Modal visible={templatePickerVisible} animationType="slide" transparent
        onRequestClose={() => setTemplatePickerVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setTemplatePickerVisible(false)}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>Choose a template</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {templates.length === 0 ? (
                <Text style={{ color: c.muted, textAlign: "center", marginTop: space.lg }}>No templates saved yet.</Text>
              ) : (
                templates.map((t) => (
                  <TouchableOpacity key={t.id} style={[s.templatePickerRow, { borderBottomColor: c.borderFaint }]}
                    onPress={() => applyTemplate(t)}>
                    <CategoryIcon name={t.category_name} emoji={t.category_icon} size={18} color={t.category_color ?? c.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.templatePickerName, { color: c.text }]}>{t.name}</Text>
                      <Text style={[s.templatePickerSub, { color: c.muted }]}>
                        {t.category_name ?? "Uncategorized"} · {t.account_name ?? ""}
                      </Text>
                    </View>
                    <Text style={[s.templatePickerAmount, { color: t.type === "expense" ? c.negative : c.positive }]}>
                      {t.type === "expense" ? "−" : "+"}{symbol}{t.amount.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function DayHeader({ label, total, c }: { label: string; total: number; c: ReturnType<typeof getColors> }) {
  const { symbol } = useCurrency();
  return (
    <View style={s.dayHeader}>
      <Text style={[s.dayLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[s.dayTotal, { color: total >= 0 ? c.positive : c.negative }]}>
        {total >= 0 ? "+" : ""}{symbol}{Math.abs(total).toFixed(2)}
      </Text>
    </View>
  );
}

function TransactionRow({ transaction: t, c, onDelete }: {
  transaction: Transaction; c: ReturnType<typeof getColors>; onDelete: () => void;
}) {
  const { symbol } = useCurrency();
  const isIncome   = t.type === "income";
  const isTransfer = t.type === "transfer";
  const amountColor = isIncome ? c.positive : isTransfer ? c.accent : c.negative;
  const sign = isIncome ? "+" : isTransfer ? "⇄" : "−";

  return (
    <View style={[s.row, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
      <View style={[s.iconWrap, { backgroundColor: c.elevated }]}>
        <CategoryIcon name={t.category_name} emoji={t.category_icon ?? (isTransfer ? "⇄" : undefined)} size={20} color={t.category_color ?? c.text} />
      </View>
      <View style={s.middle}>
        <Text style={[s.category, { color: c.text }]}>{t.category_name ?? (isTransfer ? "Transfer" : "Uncategorized")}</Text>
        {t.note ? <Text style={[s.note, { color: c.muted }]}>{t.note}</Text> : null}
        <Text style={[s.account, { color: c.muted }]}>{t.account_name ?? ""}</Text>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: amountColor }]}>{sign}{symbol}{t.amount.toFixed(2)}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={12}>
          <Text style={[s.deleteBtn, { color: c.muted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function todayString(): string { return new Date().toISOString().slice(0, 10); }

const s = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  title:        { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  addButton:    { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full },
  addButtonText:{ color: "#fff", fontWeight: "600", fontSize: 14 },
  toggleRow:    { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  toggleBtn:    { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  toggleBtnText:{ fontSize: 13, fontWeight: "600" },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space.xxl },
  emptyIcon:    { fontSize: 48, marginBottom: space.md },
  emptyIconImg: { width: 64, height: 64, marginBottom: space.md },
  emptyTitle:   { fontSize: 18, fontWeight: "600", marginBottom: space.sm },
  emptySubtitle:{ fontSize: 14, textAlign: "center" },
  overlay:      { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:        { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl, maxHeight: "90%" },
  handle:       { width: 40, height: 4, borderRadius: radius.full, alignSelf: "center", marginBottom: space.lg },
  titleRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  sheetTitle:   { fontSize: 20, fontWeight: "700" },
  templateBtn:  { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1 },
  templateBtnText: { fontSize: 13, fontWeight: "600" },
  templatePickerRow:    { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1 },
  templatePickerIcon:   { fontSize: 24 },
  templatePickerName:   { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  templatePickerSub:    { fontSize: 12 },
  templatePickerAmount: { fontSize: 16, fontWeight: "700" },
  typeRow:      { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  typeChip:     { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  fieldLabel:   { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: space.sm, marginTop: space.md },
  input:        { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  chipRow:      { flexDirection: "row", gap: space.sm, paddingVertical: 2 },
  chip:         { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1 },
  chipText:     { fontSize: 13, fontWeight: "500" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: space.xs, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.sm, borderWidth: 1, minWidth: "30%" },
  categoryIcon: { fontSize: 16 },
  categoryName: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  errorText:    { fontSize: 13, marginTop: space.sm },
  actions:      { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  cancelBtn:    { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  cancelBtnText:{ fontWeight: "600", fontSize: 15 },
  saveBtn:      { flex: 2, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  dayHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: space.sm, marginTop: space.sm },
  dayLabel:     { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  dayTotal:     { fontSize: 13, fontWeight: "600" },
  row:          { borderRadius: radius.md, padding: space.md, marginBottom: space.xs, flexDirection: "row", alignItems: "center", borderWidth: 1 },
  iconWrap:     { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginRight: space.md },
  icon:         { fontSize: 18 },
  middle:       { flex: 1 },
  category:     { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  note:         { fontSize: 12, fontStyle: "italic", marginBottom: 2 },
  account:      { fontSize: 12 },
  right:        { alignItems: "flex-end", gap: space.xs },
  amount:       { fontSize: 16, fontWeight: "700" },
  deleteBtn:    { fontSize: 11 },
});