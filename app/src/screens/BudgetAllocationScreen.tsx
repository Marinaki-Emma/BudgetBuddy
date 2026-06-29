import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "../context/ThemeContext";
import { getColors, space, radius } from "../theme";
import { getBudgetsForMonth, upsertBudget, BudgetWithSpent } from "../db/budgets";
import { getCategories, Category } from "../db/transactions";
import CategoryIcon from "../components/CategoryIcon";
import { useCurrency } from "../context/CurrencyContext";

export default function BudgetAllocationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { month, overallAmount } = route.params as { month: string; overallAmount: number };
  const { isDark } = useAppTheme();
  const { symbol } = useCurrency();
  const c = getColors(isDark);

  const [categories, setCategories]   = useState<Category[]>([]);
  const [budgets, setBudgets]         = useState<BudgetWithSpent[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try {
      const [cats, buds] = await Promise.all([
        getCategories("expense"),
        getBudgetsForMonth(month),
      ]);
      setCategories(cats);
      setBudgets(buds);

      // Pre-fill allocations from existing category budgets
      const initial: Record<string, string> = {};
      for (const cat of cats) {
        const existing = buds.find((b) => b.category_id === cat.id);
        initial[cat.id] = existing ? String(existing.amount) : "";
      }
      setAllocations(initial);
    } finally {
      setLoading(false);
    }
  }

  // Running totals
  const totalAllocated = Object.values(allocations).reduce((sum, v) => {
    const n = parseFloat(v);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const remaining   = overallAmount - totalAllocated;
  const isOver      = totalAllocated > overallAmount;
  const isExact     = Math.abs(remaining) < 0.01;

  function formatMonth(): string {
    const [year, mon] = month.split("-").map(Number);
    return new Date(year, mon - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  async function handleSave() {
    if (isOver) {
      Alert.alert(
        "Over budget",
        `Your category allocations (${symbol}${totalAllocated.toFixed(2)}) exceed your overall budget (${symbol}${overallAmount.toFixed(2)}) by ${symbol}${Math.abs(remaining).toFixed(2)}. Adjust the allocations before saving.`,
        [{ text: "OK" }]
      );
      return;
    }

    setSaving(true);
    try {
      for (const [catId, val] of Object.entries(allocations)) {
        const amount = parseFloat(val);
        if (!isNaN(amount) && amount > 0) {
          await upsertBudget({ category_id: catId, month, amount });
        }
        // If cleared (empty or 0), find and delete the existing budget
        else {
          const existing = budgets.find((b) => b.category_id === catId);
          if (existing) {
            const { deleteBudget } = await import("../db/budgets");
            await deleteBudget(existing.id);
          }
        }
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Sticky summary bar */}
      <View style={[s.summaryBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View>
          <Text style={[s.summaryMonth, { color: c.muted }]}>{formatMonth()}</Text>
          <Text style={[s.summaryTitle, { color: c.text }]}>Allocate budget</Text>
        </View>
        <View style={s.summaryRight}>
          <Text style={[s.summaryOverall, { color: c.muted }]}>
            Total: {symbol}{overallAmount.toFixed(2)}
          </Text>
          <Text style={[s.summaryAllocated, {
            color: isOver ? c.negative : isExact ? c.positive : c.text
          }]}>
            Allocated: {symbol}{totalAllocated.toFixed(2)}
          </Text>
          {isOver ? (
            <Text style={[s.summaryWarning, { color: c.negative }]}>
              ⚠ {symbol}{Math.abs(remaining).toFixed(2)} over
            </Text>
          ) : (
            <Text style={[s.summaryRemaining, { color: c.muted }]}>
              {symbol}{remaining.toFixed(2)} unallocated
            </Text>
          )}
        </View>
      </View>

      {/* Allocation bar */}
      <View style={[s.allocBar, { backgroundColor: c.elevated }]}>
        <View style={[s.allocFill, {
          width: `${Math.min((totalAllocated / overallAmount) * 100, 100)}%` as any,
          backgroundColor: isOver ? c.negative : isExact ? c.positive : c.accent,
        }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 120 }}>
        <Text style={[s.hint, { color: c.muted }]}>
          Set how much of your {symbol}{overallAmount.toFixed(2)} budget goes to each category.
          Leave a field empty to remove its budget.
        </Text>

        {categories.map((cat) => {
          const existing = budgets.find((b) => b.category_id === cat.id);
          const val = allocations[cat.id] ?? "";
          const amount = parseFloat(val);
          const hasValue = !isNaN(amount) && amount > 0;
          const pct = hasValue ? Math.round((amount / overallAmount) * 100) : 0;

          return (
            <View key={cat.id} style={[s.row, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
              <View style={[s.catIconWrap, { backgroundColor: c.elevated }]}>
                <CategoryIcon name={cat.name} emoji={cat.icon} size={20} color={cat.color ?? c.text} />
              </View>
              <View style={s.catMiddle}>
                <Text style={[s.catName, { color: c.text }]}>{cat.name}</Text>
                {existing && hasValue && (
                  <Text style={[s.catSpent, { color: c.muted }]}>
                    Spent: {symbol}{existing.spent.toFixed(2)}
                    {pct > 0 ? ` · ${pct}% of total` : ""}
                  </Text>
                )}
                {!existing && hasValue && (
                  <Text style={[s.catSpent, { color: c.muted }]}>{pct}% of total</Text>
                )}
              </View>
              <View style={s.catRight}>
                <View style={[s.inputWrap, { backgroundColor: c.elevated, borderColor: hasValue ? c.accent : c.border }]}>
                  <Text style={[s.euroSign, { color: c.muted }]}>{symbol}</Text>
                  <TextInput
                    style={[s.input, { color: c.text }]}
                    placeholder="—"
                    placeholderTextColor={c.muted}
                    value={val}
                    onChangeText={(text) => setAllocations((prev) => ({ ...prev, [cat.id]: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Sticky save button */}
      <View style={[s.footer, { backgroundColor: c.bg, borderTopColor: c.border }]}>
        {isOver && (
          <Text style={[s.overWarning, { color: c.negative }]}>
            ⚠ Allocations exceed overall budget by {symbol}{Math.abs(remaining).toFixed(2)}
          </Text>
        )}
        <View style={s.footerActions}>
          <TouchableOpacity style={[s.cancelBtn, { backgroundColor: c.elevated }]}
            onPress={() => navigation.goBack()}>
            <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: isOver ? c.elevated : c.accent },
                    saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving || isOver}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[s.saveBtnText, { color: isOver ? c.muted : "#fff" }]}>
                  Save allocations
                </Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  centered:         { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: space.md, borderBottomWidth: 1 },
  summaryMonth:     { fontSize: 12, marginBottom: 2 },
  summaryTitle:     { fontSize: 18, fontWeight: "700" },
  summaryRight:     { alignItems: "flex-end" },
  summaryOverall:   { fontSize: 12, marginBottom: 2 },
  summaryAllocated: { fontSize: 15, fontWeight: "700" },
  summaryWarning:   { fontSize: 12, fontWeight: "600", marginTop: 2 },
  summaryRemaining: { fontSize: 12, marginTop: 2 },
  allocBar:         { height: 6, marginHorizontal: space.md, borderRadius: radius.full, overflow: "hidden", marginBottom: space.md },
  allocFill:        { height: 6, borderRadius: radius.full },
  hint:             { fontSize: 13, lineHeight: 19, marginBottom: space.lg },
  row:              { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: 1, gap: space.md },
  catIconWrap:      { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  catIcon:          { fontSize: 18 },
  catMiddle:        { flex: 1 },
  catName:          { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  catSpent:         { fontSize: 12 },
  catRight:         { alignItems: "flex-end" },
  inputWrap:        { flexDirection: "row", alignItems: "center", borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 6, minWidth: 90 },
  euroSign:         { fontSize: 14, marginRight: 2 },
  input:            { fontSize: 15, fontWeight: "600", minWidth: 60, textAlign: "right" },
  footer:           { position: "absolute", bottom: 0, left: 0, right: 0, padding: space.md, borderTopWidth: 1 },
  overWarning:      { fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: space.sm },
  footerActions:    { flexDirection: "row", gap: space.sm },
  cancelBtn:        { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  cancelBtnText:    { fontWeight: "600", fontSize: 15 },
  saveBtn:          { flex: 2, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText:      { fontWeight: "700", fontSize: 15 },
});