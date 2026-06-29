import { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { getColors, space, radius } from "../theme";
import {
  getRecurringTemplates, getUpcomingReminders, createRecurringTemplate,
  toggleRecurringTemplate, deleteRecurringTemplate,
  RecurringTemplate, UpcomingReminder,
} from "../db/recurring";
import { getAccounts, Account } from "../db/accounts";
import { getCategories, Category } from "../db/transactions";
import CategoryIcon from "../components/CategoryIcon";

type ViewTab = "upcoming" | "all";

export default function RecurringScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const c = getColors(isDark);

  const [tab, setTab]               = useState<ViewTab>("upcoming");
  const [reminders, setReminders]   = useState<UpcomingReminder[]>([]);
  const [templates, setTemplates]   = useState<RecurringTemplate[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName]             = useState("");
  const [txType, setTxType]         = useState<"expense" | "income">("expense");
  const [amount, setAmount]         = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [accountId, setAccountId]   = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useFocusEffect(useCallback(() => { load(); }, []));
  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      const [remList, tmplList, acctList, catList] = await Promise.all([
        getUpcomingReminders(), getRecurringTemplates(),
        getAccounts(), getCategories(),
      ]);
      setReminders(remList); setTemplates(tmplList);
      setAccounts(acctList); setCategories(catList);
      if (acctList.length > 0 && !accountId) setAccountId(acctList[0].id);
    } finally { setLoading(false); }
  }

  function openModal(prefillTemplate?: RecurringTemplate) {
    if (prefillTemplate) {
      setName(prefillTemplate.name); setTxType(prefillTemplate.type);
      setAmount(String(prefillTemplate.amount));
      setDayOfMonth(String(prefillTemplate.day_of_month));
      setAccountId(prefillTemplate.account_id); setCategoryId(prefillTemplate.category_id);
    } else {
      setName(""); setTxType("expense"); setAmount(""); setDayOfMonth("1");
      setAccountId(accounts[0]?.id ?? null); setCategoryId(null);
    }
    setError(null); setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required."); return; }
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount."); return; }
    const day = parseInt(dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) { setError("Day must be between 1 and 31."); return; }
    if (!categoryId) { setError("Select a category."); return; }
    setSaving(true);
    try {
      await createRecurringTemplate({ name: name.trim(), type: txType, account_id: accountId, category_id: categoryId, amount: parsed, day_of_month: day });
      setModalVisible(false); await load();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  function handleLogNow(reminder: UpcomingReminder) {
    navigation.navigate("Transactions", { prefill: reminder.template });
  }

  const filteredCats = categories.filter((cat) => cat.kind === txType);
  const active = templates.filter((t) => t.is_active);
  const paused = templates.filter((t) => !t.is_active);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: space.md, paddingTop: space.lg }}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Recurring</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={() => openModal()}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabRow}>
        {(["upcoming", "all"] as ViewTab[]).map((t) => (
          <TouchableOpacity key={t}
            style={[s.tab, { backgroundColor: c.surface, borderColor: tab === t ? c.accent : c.border },
                    tab === t && { backgroundColor: c.accentDim }]}
            onPress={() => setTab(t)}>
            <Text style={[s.tabText, { color: tab === t ? c.textAccent : c.muted }]}>
              {t === "upcoming" ? "Upcoming" : "All templates"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
      ) : tab === "upcoming" ? (
        <UpcomingList reminders={reminders} onLogNow={handleLogNow} c={c} />
      ) : (
        <AllList active={active} paused={paused} c={c}
          onToggle={(id, val) => toggleRecurringTemplate(id, val).then(load)}
          onDelete={(id) => deleteRecurringTemplate(id).then(load)}
          onEdit={(t) => openModal(t)} />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>New recurring template</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.typeRow}>
                {(["expense", "income"] as const).map((t) => (
                  <TouchableOpacity key={t}
                    style={[s.typeChip, { backgroundColor: c.elevated, borderColor: c.border },
                      txType === t && t === "expense" && { borderColor: c.negative },
                      txType === t && t === "income"  && { borderColor: c.positive },
                    ]}
                    onPress={() => setTxType(t)}>
                    <Text style={[s.typeChipText, { color: c.muted },
                      txType === t && t === "expense" && { color: c.negative },
                      txType === t && t === "income"  && { color: c.positive },
                    ]}>
                      {t === "expense" ? "− Expense" : "+ Income"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { color: c.muted }]}>Name</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="e.g. Netflix, Rent, Salary" placeholderTextColor={c.muted}
                value={name} onChangeText={setName} autoFocus />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Amount ({symbol})</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="0.00" placeholderTextColor={c.muted} value={amount}
                onChangeText={setAmount} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { color: c.muted }]}>Day of month</Text>
              <TextInput style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="e.g. 1, 15, 28" placeholderTextColor={c.muted} value={dayOfMonth}
                onChangeText={setDayOfMonth} keyboardType="number-pad" />
              <Text style={[s.hint, { color: c.muted }]}>Enter the day this is typically due each month.</Text>

              <Text style={[s.fieldLabel, { color: c.muted }]}>Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
    </View>
  );
}

function UpcomingList({ reminders, onLogNow, c }: {
  reminders: UpcomingReminder[]; onLogNow: (r: UpcomingReminder) => void;
  c: ReturnType<typeof getColors>;
}) {
  if (reminders.length === 0) {
    return (
      <View style={s.empty}>
        <Image source={require("../../assets/icons/recurring_payment.png")}
          style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
        <Text style={[s.emptyTitle, { color: c.text }]}>No recurring templates yet</Text>
        <Text style={[s.emptySubtitle, { color: c.muted }]}>Tap "+ Add" to set up your first one.</Text>
      </View>
    );
  }
  const overdue  = reminders.filter((r) => r.days_until < 0 && !r.is_logged);
  const upcoming = reminders.filter((r) => r.days_until >= 0 && !r.is_logged);
  const logged   = reminders.filter((r) => r.is_logged);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }}>
      {overdue.length > 0 && (<>
        <Text style={[u.sectionLabel, { color: c.muted }]}>Overdue</Text>
        {overdue.map((r) => <ReminderCard key={r.template.id} reminder={r} onLogNow={onLogNow} c={c} />)}
      </>)}
      {upcoming.length > 0 && (<>
        <Text style={[u.sectionLabel, { color: c.muted }]}>This month</Text>
        {upcoming.map((r) => <ReminderCard key={r.template.id} reminder={r} onLogNow={onLogNow} c={c} />)}
      </>)}
      {logged.length > 0 && (<>
        <Text style={[u.sectionLabel, { color: c.muted }]}>Already logged</Text>
        {logged.map((r) => <ReminderCard key={r.template.id} reminder={r} onLogNow={onLogNow} c={c} />)}
      </>)}
    </ScrollView>
  );
}

function ReminderCard({ reminder: r, onLogNow, c }: {
  reminder: UpcomingReminder; onLogNow: (r: UpcomingReminder) => void;
  c: ReturnType<typeof getColors>;
}) {
  const { symbol } = useCurrency();
  const t = r.template;
  const isOverdue = r.days_until < 0 && !r.is_logged;
  const isToday   = r.days_until === 0 && !r.is_logged;
  const isExpense = t.type === "expense";
  const dueLabelColor = isOverdue ? c.negative : isToday ? "#FBBF24" : c.muted;
  const dueLabel =
    r.is_logged  ? "✓ Logged" :
    isOverdue    ? `${Math.abs(r.days_until)} day${Math.abs(r.days_until) === 1 ? "" : "s"} overdue` :
    isToday      ? "Due today" :
    r.days_until === 1 ? "Due tomorrow" :
    `Due in ${r.days_until} days`;
  return (
    <View style={[u.card, { backgroundColor: c.surface, borderColor: c.borderFaint }, r.is_logged && { opacity: 0.5 }]}>
      <View style={[u.iconWrap, { backgroundColor: c.elevated }]}>
        <CategoryIcon name={t.category_name} emoji={t.category_icon} size={20} color={t.category_color ?? c.text} />
      </View>
      <View style={u.middle}>
        <Text style={[u.name, { color: c.text }]}>{t.name}</Text>
        <Text style={[u.category, { color: c.muted }]}>{t.category_name ?? "Uncategorized"}</Text>
        <Text style={[u.due, { color: dueLabelColor }]}>{dueLabel}</Text>
      </View>
      <View style={u.right}>
        <Text style={[u.amount, { color: isExpense ? c.negative : c.positive }]}>
          {isExpense ? "−" : "+"}{symbol}{t.amount.toFixed(2)}
        </Text>
        {!r.is_logged && (
          <TouchableOpacity style={[u.logBtn, { backgroundColor: c.accent }]} onPress={() => onLogNow(r)}>
            <Text style={u.logBtnText}>Log</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AllList({ active, paused, onToggle, onDelete, onEdit, c }: {
  active: RecurringTemplate[]; paused: RecurringTemplate[];
  onToggle: (id: string, val: boolean) => void; onDelete: (id: string) => void;
  onEdit: (t: RecurringTemplate) => void; c: ReturnType<typeof getColors>;
}) {
  if (active.length === 0 && paused.length === 0) {
    return (
      <View style={s.empty}>
        <Image source={require("../../assets/icons/template.png")}
          style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
        <Text style={[s.emptyTitle, { color: c.text }]}>No templates yet</Text>
        <Text style={[s.emptySubtitle, { color: c.muted }]}>Tap "+ Add" to create your first recurring template.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }}>
      {active.length > 0 && (<>
        <Text style={[u.sectionLabel, { color: c.muted }]}>Active</Text>
        {active.map((t) => <TemplateRow key={t.id} template={t} c={c}
          onToggle={() => onToggle(t.id, false)} onDelete={() => onDelete(t.id)} onEdit={() => onEdit(t)} />)}
      </>)}
      {paused.length > 0 && (<>
        <Text style={[u.sectionLabel, { color: c.muted }]}>Paused</Text>
        {paused.map((t) => <TemplateRow key={t.id} template={t} c={c}
          onToggle={() => onToggle(t.id, true)} onDelete={() => onDelete(t.id)} onEdit={() => onEdit(t)} />)}
      </>)}
    </ScrollView>
  );
}

function TemplateRow({ template: t, onToggle, onDelete, onEdit, c }: {
  template: RecurringTemplate; onToggle: () => void; onDelete: () => void;
  onEdit: () => void; c: ReturnType<typeof getColors>;
}) {
  const { symbol } = useCurrency();
  const isExpense = t.type === "expense";
  return (
    <View style={[u.card, { backgroundColor: c.surface, borderColor: c.borderFaint }, !t.is_active && { opacity: 0.5 }]}>
      <View style={[u.iconWrap, { backgroundColor: c.elevated }]}>
        <CategoryIcon name={t.category_name} emoji={t.category_icon} size={20} color={t.category_color ?? c.text} />
      </View>
      <View style={u.middle}>
        <Text style={[u.name, { color: c.text }]}>{t.name}</Text>
        <Text style={[u.category, { color: c.muted }]}>{t.category_name ?? "Uncategorized"}</Text>
        <Text style={[u.due, { color: c.muted }]}>Every month on the {ordinal(t.day_of_month)}</Text>
      </View>
      <View style={u.right}>
        <Text style={[u.amount, { color: isExpense ? c.negative : c.positive }]}>
          {isExpense ? "−" : "+"}{symbol}{t.amount.toFixed(2)}
        </Text>
        <View style={u.rowActions}>
          <TouchableOpacity onPress={onToggle} hitSlop={8}>
            <Text style={[u.actionBtn, { color: c.muted }]}>{t.is_active ? "Pause" : "Resume"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <Text style={[u.actionBtn, { color: c.negative }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ordinal(n: number): string {
  const sv = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (sv[(v - 20) % 10] || sv[v] || sv[0]);
}

const s = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  title:        { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  addBtn:       { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full },
  addBtnText:   { color: "#fff", fontWeight: "600", fontSize: 14 },
  tabRow:       { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  tab:          { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  tabText:      { fontSize: 13, fontWeight: "600" },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space.xxl },
  emptyIcon:    { fontSize: 48, marginBottom: space.md },
  emptyIconImg: { width: 64, height: 64, marginBottom: space.md },
  emptyTitle:   { fontSize: 18, fontWeight: "600", marginBottom: space.sm },
  emptySubtitle:{ fontSize: 14, textAlign: "center" },
  overlay:      { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:        { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl, maxHeight: "90%" },
  handle:       { width: 40, height: 4, borderRadius: radius.full, alignSelf: "center", marginBottom: space.lg },
  sheetTitle:   { fontSize: 20, fontWeight: "700", marginBottom: space.md },
  typeRow:      { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  typeChip:     { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  fieldLabel:   { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: space.sm, marginTop: space.md },
  input:        { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  hint:         { fontSize: 12, marginTop: space.xs },
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
});

const u = StyleSheet.create({
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: space.sm, marginTop: space.sm },
  card:         { borderRadius: radius.md, padding: space.md, marginBottom: space.sm, flexDirection: "row", alignItems: "center", borderWidth: 1 },
  iconWrap:     { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginRight: space.md },
  icon:         { fontSize: 18 },
  middle:       { flex: 1 },
  name:         { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  category:     { fontSize: 12, marginBottom: 2 },
  due:          { fontSize: 12, fontWeight: "500" },
  right:        { alignItems: "flex-end", gap: space.xs },
  amount:       { fontSize: 16, fontWeight: "700" },
  logBtn:       { borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 4 },
  logBtnText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  rowActions:   { flexDirection: "row", gap: space.sm },
  actionBtn:    { fontSize: 12, fontWeight: "600" },
});