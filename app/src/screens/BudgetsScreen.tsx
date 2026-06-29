import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { getColors, space, radius } from "../theme";
import {
  getBudgetsForMonth, getBudgetMonths, upsertBudget, deleteBudget,
  BudgetWithSpent,
} from "../db/budgets";
import { getCategories, Category, seedCategoriesIfEmpty } from "../db/transactions";
import CategoryIcon from "../components/CategoryIcon";
import { useCurrency } from "../context/CurrencyContext";


function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function BudgetsScreen() {
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const navigation = useNavigation<any>();
  const c = getColors(isDark);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [budgets, setBudgets]               = useState<BudgetWithSpent[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [loading, setLoading]               = useState(true);
  const [modalVisible, setModalVisible]     = useState(false);

  // Form state
  const [editingBudget, setEditingBudget]   = useState<BudgetWithSpent | null>(null);
  const [isOverall, setIsOverall]           = useState(false);
  const [categoryId, setCategoryId]         = useState<string | null>(null);
  const [amount, setAmount]                 = useState("");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  // Track how many category budgets were added in this modal session
  const [chainCount, setChainCount]         = useState(0);

  useFocusEffect(useCallback(() => { load(); }, [selectedMonth]));

  async function load() {
  setLoading(true);
  try {
    await seedCategoriesIfEmpty();
    const [b, months, cats] = await Promise.all([
      getBudgetsForMonth(selectedMonth),
      getBudgetMonths(),
      getCategories("expense"),
    ]);
      setBudgets(b);
      const allMonths = Array.from(new Set([currentMonthStr(), ...months])).sort().reverse();
      setAvailableMonths(allMonths);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingBudget(null);
    setIsOverall(false);
    setCategoryId(null);
    setAmount("");
    setError(null);
    setChainCount(0);
    setModalVisible(true);
  }

  function openEdit(budget: BudgetWithSpent) {
    setEditingBudget(budget);
    setIsOverall(budget.category_id === null);
    setCategoryId(budget.category_id);
    setAmount(String(budget.amount));
    setError(null);
    setChainCount(0);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    if (chainCount > 0) load(); // reload if we added anything in chain mode
  }

  async function handleSave(andAddAnother = false) {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!isOverall && !categoryId) {
      setError("Select a category.");
      return;
    }

    // Warn if category budgets will exceed overall
    if (!isOverall && !editingBudget) {
      const overallBudget = budgets.find((b) => b.category_id === null);
      if (overallBudget) {
        const currentCatTotal = budgets
          .filter((b) => b.category_id !== null)
          .reduce((sum, b) => sum + b.amount, 0);
        if (currentCatTotal + parsed > overallBudget.amount) {
          setError(
            `This would put total category budgets at ${symbol}${(currentCatTotal + parsed).toFixed(2)}, ` +
            `exceeding your overall budget of ${symbol}${overallBudget.amount.toFixed(2)}.`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      await upsertBudget({
        category_id: isOverall ? null : categoryId,
        month: selectedMonth,
        amount: parsed,
      });

      if (andAddAnother && !isOverall && !editingBudget) {
        // Chain: reload budgets silently, reset form for next entry
        const b = await getBudgetsForMonth(selectedMonth);
        setBudgets(b);
        setCategoryId(null);
        setAmount("");
        setError(null);
        setChainCount((n) => n + 1);
      } else {
        setModalVisible(false);
        await load();
      }
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteBudget(id);
    await load();
  }

  const overallBudget    = budgets.find((b) => b.category_id === null);
  const categoryBudgets  = budgets.filter((b) => b.category_id !== null);

  // Total amount allocated across category budgets
  const totalAllocated = categoryBudgets.reduce((sum, b) => sum + b.amount, 0);

  // Categories without a budget this month (excluding ones just added in chain)
  const budgetedCatIds = budgets.filter((b) => b.category_id !== null).map((b) => b.category_id!);
  const unbudgetedCats = categories.filter((cat) => !budgetedCatIds.includes(cat.id));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: c.text }]}>Budgets</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={openAdd}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Month selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginBottom: space.lg }} contentContainerStyle={{ gap: space.sm }}>
          {availableMonths.map((month) => (
            <TouchableOpacity key={month}
              style={[s.monthChip, { backgroundColor: c.surface, borderColor: c.border },
                      selectedMonth === month && { borderColor: c.accent, backgroundColor: c.accentDim }]}
              onPress={() => setSelectedMonth(month)}>
              <Text style={[s.monthChipText, { color: selectedMonth === month ? c.textAccent : c.muted }]}>
                {new Date(month).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
        ) : budgets.length === 0 ? (
          <View style={s.empty}>
            <Image source={require("../../assets/icons/aim.png")}
              style={s.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
            <Text style={[s.emptyTitle, { color: c.text }]}>No budgets for this month</Text>
            <Text style={[s.emptySubtitle, { color: c.muted }]}>
              Tap "+ Add" to set your first budget for{" "}
              {new Date(selectedMonth).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.
            </Text>
          </View>
        ) : (
          <>
            {/* Overall budget */}
            {overallBudget && (
              <>
                <Text style={[s.sectionLabel, { color: c.muted }]}>Overall</Text>
                <BudgetCard
                  budget={overallBudget}
                  c={c}
                  totalAllocated={totalAllocated}
                  onEdit={() => openEdit(overallBudget)}
                  onDelete={() => handleDelete(overallBudget.id)}
                  onAllocate={() => navigation.navigate("BudgetAllocation", {
                    month: selectedMonth,
                    overallAmount: overallBudget.amount,
                  })}
                />
              </>
            )}

            {/* Per-category budgets */}
            {categoryBudgets.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { color: c.muted }]}>By category</Text>
                {categoryBudgets.map((b) => (
                  <BudgetCard key={b.id} budget={b} c={c}
                    onEdit={() => openEdit(b)}
                    onDelete={() => handleDelete(b.id)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent
        onRequestClose={closeModal}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={[s.handle, { backgroundColor: c.elevated }]} />
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { color: c.text }]}>
                {editingBudget ? "Edit budget" : chainCount > 0 ? `Add another (${chainCount} added)` : "New budget"}
              </Text>
              {chainCount > 0 && (
                <TouchableOpacity onPress={closeModal}>
                  <Text style={[s.doneBtn, { color: c.textAccent }]}>Done</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Overall vs category toggle — only for new budgets */}
              {!editingBudget && chainCount === 0 && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Type</Text>
                  <View style={s.typeRow}>
                    <TouchableOpacity
                      style={[s.typeChip, { backgroundColor: c.elevated, borderColor: isOverall ? c.accent : c.border },
                              isOverall && { backgroundColor: c.accentDim }]}
                      onPress={() => { setIsOverall(true); setCategoryId(null); }}>
                      <Text style={[s.typeChipText, { color: isOverall ? c.textAccent : c.muted }]}>Overall total</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.typeChip, { backgroundColor: c.elevated, borderColor: !isOverall ? c.accent : c.border },
                              !isOverall && { backgroundColor: c.accentDim }]}
                      onPress={() => setIsOverall(false)}>
                      <Text style={[s.typeChipText, { color: !isOverall ? c.textAccent : c.muted }]}>Per category</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Category picker */}
              {!isOverall && !editingBudget && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Category</Text>
                  {unbudgetedCats.length === 0 ? (
                    <Text style={[s.hint, { color: c.muted }]}>
                      All expense categories already have a budget this month.
                    </Text>
                  ) : (
                    <View style={s.categoryGrid}>
                      {unbudgetedCats.map((cat) => (
                        <TouchableOpacity key={cat.id}
                          style={[s.categoryChip, { backgroundColor: c.elevated, borderColor: c.border },
                            categoryId === cat.id && { borderColor: cat.color ?? c.accent, backgroundColor: (cat.color ?? c.accent) + "22" }]}
                          onPress={() => setCategoryId(cat.id)}>
                          <CategoryIcon name={cat.name} emoji={cat.icon} size={18} color={cat.color ?? c.accent} />
                          <Text style={[s.catName, { color: categoryId === cat.id ? (cat.color ?? c.accent) : c.muted }]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Show which category is being edited */}
              {editingBudget && editingBudget.category_id && (
                <>
                  <Text style={[s.fieldLabel, { color: c.muted }]}>Category</Text>
                  <View style={[s.categoryChip, { borderColor: editingBudget.category_color ?? c.accent, backgroundColor: (editingBudget.category_color ?? c.accent) + "22", alignSelf: "flex-start" }]}>
                    <CategoryIcon name={editingBudget.category_name} emoji={editingBudget.category_icon} size={18} color={editingBudget.category_color ?? c.accent} />
                    <Text style={[s.catName, { color: editingBudget.category_color ?? c.accent }]}>{editingBudget.category_name}</Text>
                  </View>
                </>
              )}

              {/* Amount */}
              <Text style={[s.fieldLabel, { color: c.muted }]}>Budget amount ({symbol})</Text>
              <TextInput
                style={[s.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
                placeholder="0.00" placeholderTextColor={c.muted}
                value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />

              {/* Overall allocation warning */}
              {!isOverall && !editingBudget && overallBudget && (() => {
                const currentCatTotal = categoryBudgets.reduce((sum, b) => sum + b.amount, 0);
                const parsed = parseFloat(amount);
                const newTotal = currentCatTotal + (isNaN(parsed) ? 0 : parsed);
                const remaining = overallBudget.amount - newTotal;
                if (newTotal > 0) {
                  return (
                    <Text style={[s.hint, { color: remaining < 0 ? c.negative : c.muted }]}>
                      {remaining >= 0
                        ? `${symbol}${remaining.toFixed(2)} of overall budget (${symbol}${overallBudget.amount.toFixed(2)}) still unallocated`
                        : `⚠ ${symbol}${Math.abs(remaining).toFixed(2)} over overall budget`}
                    </Text>
                  );
                }
                return null;
              })()}

              {error && <Text style={[s.errorText, { color: c.negative }]}>{error}</Text>}

              {/* Actions */}
              <View style={s.actions}>
                <Pressable style={[s.cancelBtn, { backgroundColor: c.elevated }]} onPress={closeModal}>
                  <Text style={[s.cancelBtnText, { color: c.muted }]}>
                    {chainCount > 0 ? "Done" : "Cancel"}
                  </Text>
                </Pressable>
                {/* Show "+ Add another" only for per-category new budgets */}
                {!isOverall && !editingBudget && unbudgetedCats.length > 1 && (
                  <Pressable style={[s.addAnotherBtn, { backgroundColor: c.elevated, borderColor: c.accent }, saving && { opacity: 0.6 }]}
                    onPress={() => handleSave(true)} disabled={saving}>
                    <Text style={[s.addAnotherBtnText, { color: c.textAccent }]}>+ Add another</Text>
                  </Pressable>
                )}
                <Pressable style={[s.saveBtn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]}
                  onPress={() => handleSave(false)} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveBtnText}>{editingBudget ? "Save" : "Save"}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Budget card ──────────────────────────────────────────────────────────────

function BudgetCard({ budget: b, c, totalAllocated, onEdit, onDelete, onAllocate }: {
  budget: BudgetWithSpent;
  c: ReturnType<typeof getColors>;
  totalAllocated?: number;
  onEdit: () => void;
  onDelete: () => void;
  onAllocate?: () => void;
}) {
  const { symbol } = useCurrency();
  const isOverall = b.category_id === null;
  const isOver    = b.percentage > 100;
  const isWarning = b.percentage >= 80 && !isOver;
  const barColor  = isOver ? c.negative : isWarning ? "#FBBF24" : c.positive;

  // For overall card: also show allocation progress
  const allocPct = (isOverall && totalAllocated !== undefined && b.amount > 0)
    ? Math.min((totalAllocated / b.amount) * 100, 100)
    : 0;
  const isAllocOver = isOverall && totalAllocated !== undefined && totalAllocated > b.amount;

  return (
    <View style={[bc.card, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
      <View style={bc.topRow}>
        <View style={bc.left}>
          <View style={[bc.iconWrap, { backgroundColor: c.elevated }]}>
            {isOverall ? (
              <Image source={require("../../assets/icons/aim.png")}
                style={{ width: 22, height: 22 }} tintColor={c.accent} resizeMode="contain" />
            ) : (
              <CategoryIcon name={b.category_name} emoji={b.category_icon} size={20} color={b.category_color ?? c.text} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[bc.name, { color: c.text }]}>
              {isOverall ? "Overall spending" : b.category_name ?? "Unknown"}
            </Text>
            <Text style={[bc.sub, { color: c.muted }]}>
              {symbol}{b.spent.toFixed(2)} spent · {symbol}{b.amount.toFixed(2)} budget
            </Text>
          </View>
        </View>
        <View style={bc.right}>
          <Text style={[bc.pct, { color: isOver ? c.negative : isWarning ? "#FBBF24" : c.text }]}>
            {b.percentage}%
          </Text>
          <View style={bc.rowActions}>
            {onAllocate && (
              <TouchableOpacity onPress={onAllocate} hitSlop={8}>
                <Text style={[bc.actionBtn, { color: c.textAccent }]}>Allocate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onEdit} hitSlop={8}>
              <Text style={[bc.actionBtn, { color: c.muted }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={8}>
              <Text style={[bc.actionBtn, { color: c.negative }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Spending progress bar */}
      <View style={[bc.barTrack, { backgroundColor: c.elevated }]}>
        <View style={[bc.barFill, { width: `${Math.min(b.percentage, 100)}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[bc.barLabel, { color: c.muted }]}>Spent</Text>

      {/* Allocation bar — only for overall when category budgets exist */}
      {isOverall && totalAllocated !== undefined && totalAllocated > 0 && (
        <>
          <View style={[bc.barTrack, { backgroundColor: c.elevated, marginTop: space.sm }]}>
            <View style={[bc.barFill, {
              width: `${allocPct}%` as any,
              backgroundColor: isAllocOver ? c.negative : c.accent,
            }]} />
          </View>
          <View style={bc.allocRow}>
            <Text style={[bc.barLabel, { color: c.muted }]}>Allocated</Text>
            <Text style={[bc.allocAmt, { color: isAllocOver ? c.negative : c.muted }]}>
              {symbol}{totalAllocated.toFixed(2)} of {symbol}{b.amount.toFixed(2)}
              {isAllocOver ? " ⚠ over" : ""}
            </Text>
          </View>
        </>
      )}

      {/* Remaining */}
      <Text style={[bc.remaining, { color: b.remaining >= 0 ? c.muted : c.negative, marginTop: space.sm }]}>
        {b.remaining >= 0
          ? `${symbol}${b.remaining.toFixed(2)} remaining`
          : `${symbol}${Math.abs(b.remaining).toFixed(2)} over budget`}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  title:           { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  addBtn:          { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.full },
  addBtnText:      { color: "#fff", fontWeight: "600", fontSize: 14 },
  monthChip:       { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1 },
  monthChipText:   { fontSize: 13, fontWeight: "500" },
  sectionLabel:    { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: space.sm, marginTop: space.sm },
  empty:           { alignItems: "center", justifyContent: "center", paddingVertical: space.xxl },
  emptyIcon:       { fontSize: 48, marginBottom: space.md },
  emptyIconImg:    { width: 64, height: 64, marginBottom: space.md },
  emptyTitle:      { fontSize: 18, fontWeight: "600", marginBottom: space.sm },
  emptySubtitle:   { fontSize: 14, textAlign: "center", lineHeight: 20 },
  overlay:         { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:           { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xxl, maxHeight: "92%" },
  handle:          { width: 40, height: 4, borderRadius: radius.full, alignSelf: "center", marginBottom: space.lg },
  sheetHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  sheetTitle:      { fontSize: 20, fontWeight: "700" },
  doneBtn:         { fontSize: 16, fontWeight: "600" },
  typeRow:         { flexDirection: "row", gap: space.sm, marginBottom: space.sm },
  typeChip:        { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  typeChipText:    { fontSize: 13, fontWeight: "600" },
  fieldLabel:      { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: space.sm, marginTop: space.md },
  input:           { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  hint:            { fontSize: 12, marginTop: space.sm },
  categoryGrid:    { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  categoryChip:    { flexDirection: "row", alignItems: "center", gap: space.xs, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.sm, borderWidth: 1, minWidth: "30%" },
  catIcon:         { fontSize: 16 },
  catName:         { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  errorText:       { fontSize: 13, marginTop: space.sm },
  actions:         { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  cancelBtn:       { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  cancelBtnText:   { fontWeight: "600", fontSize: 15 },
  addAnotherBtn:   { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
  addAnotherBtnText: { fontWeight: "600", fontSize: 13 },
  saveBtn:         { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const bc = StyleSheet.create({
  card:       { borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: 1 },
  topRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: space.md },
  left:       { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  iconWrap:   { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  icon:       { fontSize: 18 },
  name:       { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  sub:        { fontSize: 12 },
  right:      { alignItems: "flex-end", gap: space.xs },
  pct:        { fontSize: 18, fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: space.md },
  actionBtn:  { fontSize: 12, fontWeight: "600" },
  barTrack:   { height: 8, borderRadius: radius.full, overflow: "hidden" },
  barFill:    { height: 8, borderRadius: radius.full },
  barLabel:   { fontSize: 11, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  allocRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  allocAmt:   { fontSize: 11 },
  remaining:  { fontSize: 12, fontWeight: "500" },
});