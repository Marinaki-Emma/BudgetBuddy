import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Svg, G, Path, Circle, Rect, Text as SvgText } from "react-native-svg";
import { useAppTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { getColors, space, radius } from "../theme";
import AccountTypeIcon from "../components/AccountTypeIcon";
import CategoryIcon from "../components/CategoryIcon";
import {
  getMonthlySummary, getLastNMonthsSummary, getCategorySpend,
  getTransactionMonths, getAccountBalances, getAccountActivity,
  MonthlySummary, CategorySpend, AccountBalance, AccountActivity,
} from "../db/reports";

type ReportTab = "current" | "3months" | "pick";
const SCREEN_WIDTH = Dimensions.get("window").width;

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ReportsScreen() {
  const { isDark } = useAppTheme();
  const c = getColors(isDark);

  const [tab, setTab]                       = useState<ReportTab>("current");
  const [selectedMonth, setSelectedMonth]   = useState(currentMonthStr());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [summary, setSummary]               = useState<MonthlySummary | null>(null);
  const [multiSummary, setMultiSummary]     = useState<MonthlySummary[]>([]);
  const [categorySpend, setCategorySpend]   = useState<CategorySpend[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [accountActivity, setAccountActivity] = useState<AccountActivity[]>([]);
  const [loading, setLoading]               = useState(true);

  useFocusEffect(useCallback(() => { load(); }, [tab, selectedMonth]));

  async function load() {
    setLoading(true);
    try {
      const months = await getTransactionMonths();
      const allMonths = Array.from(new Set([currentMonthStr(), ...months])).sort().reverse();
      setAvailableMonths(allMonths);

      const activeMonth = tab === "current" ? currentMonthStr()
                        : tab === "3months" ? currentMonthStr()
                        : selectedMonth;

      if (tab === "current") {
        const [s, cats, balances, activity] = await Promise.all([
          getMonthlySummary(currentMonthStr()),
          getCategorySpend(currentMonthStr()),
          getAccountBalances(),
          getAccountActivity(currentMonthStr()),
        ]);
        setSummary(s); setMultiSummary([]);
        setCategorySpend(cats);
        setAccountBalances(balances);
        setAccountActivity(activity);
      } else if (tab === "3months") {
        const [multi, cats, balances, activity] = await Promise.all([
          getLastNMonthsSummary(3),
          getCategorySpend(currentMonthStr()),
          getAccountBalances(),
          getAccountActivity(currentMonthStr()),
        ]);
        setSummary(multi[multi.length - 1]); setMultiSummary(multi);
        setCategorySpend(cats);
        setAccountBalances(balances);
        setAccountActivity(activity);
      } else {
        const [s, cats, balances, activity] = await Promise.all([
          getMonthlySummary(selectedMonth),
          getCategorySpend(selectedMonth),
          getAccountBalances(),
          getAccountActivity(selectedMonth),
        ]);
        setSummary(s); setMultiSummary([]);
        setCategorySpend(cats);
        setAccountBalances(balances);
        setAccountActivity(activity);
      }
    } finally {
      setLoading(false);
    }
  }

  const tabLabel = tab === "current" ? (summary?.label ?? "This month")
                 : tab === "3months" ? "Last 3 months"
                 : new Date(selectedMonth).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}>
        {/* Header */}
        <Text style={[styles.title, { color: c.text }]}>Reports</Text>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          {(["current", "3months", "pick"] as ReportTab[]).map((t) => (
            <TouchableOpacity key={t}
              style={[styles.tab, { backgroundColor: c.surface, borderColor: tab === t ? c.accent : c.border },
                      tab === t && { backgroundColor: c.accentDim }]}
              onPress={() => setTab(t)}>
              <Text style={[styles.tabText, { color: tab === t ? c.textAccent : c.muted }]}>
                {t === "current" ? "This month" : t === "3months" ? "3 months" : "Pick month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Month picker — only when tab === "pick" */}
        {tab === "pick" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: space.md }} contentContainerStyle={{ gap: space.sm }}>
            {availableMonths.map((month) => (
              <TouchableOpacity key={month}
                style={[styles.monthChip, { backgroundColor: c.surface, borderColor: c.border },
                        selectedMonth === month && { borderColor: c.accent, backgroundColor: c.accentDim }]}
                onPress={() => setSelectedMonth(month)}>
                <Text style={[styles.monthChipText, { color: selectedMonth === month ? c.textAccent : c.muted }]}>
                  {new Date(month).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
        ) : (
          <>
            {/* ── Monthly summary cards ── */}
            <Text style={[styles.sectionLabel, { color: c.muted }]}>{tabLabel}</Text>

            {summary && (
              <View style={styles.summaryRow}>
                <SummaryCard label="Income" amount={summary.income} color={c.positive} bg={c.surface} textColor={c.text} mutedColor={c.muted} />
                <SummaryCard label="Expenses" amount={summary.expenses} color={c.negative} bg={c.surface} textColor={c.text} mutedColor={c.muted} />
                <SummaryCard label="Net" amount={summary.net} color={summary.net >= 0 ? c.positive : c.negative} bg={c.surface} textColor={c.text} mutedColor={c.muted} />
              </View>
            )}

            {/* ── Bar chart ── */}
            {tab === "3months" && multiSummary.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.muted, marginTop: space.lg }]}>
                  Income vs Expenses
                </Text>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
                  <BarChart data={multiSummary} c={c} />
                </View>
              </>
            )}

            {/* ── Donut chart + category breakdown ── */}
            {categorySpend.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: c.muted, marginTop: space.lg }]}>
                  Spending by category
                </Text>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
                  <DonutChart data={categorySpend} c={c} />
                </View>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint, marginTop: space.sm }]}>
                  {categorySpend.map((cat, i) => (
                    <CategoryRow key={cat.category_id} cat={cat} c={c} isLast={i === categorySpend.length - 1} />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.empty}>
                <Image source={require("../../assets/icons/chart.png")}
                  style={styles.emptyIconImg} tintColor={c.accent} resizeMode="contain" />
                <Text style={[styles.emptyTitle, { color: c.text }]}>No spending data</Text>
                <Text style={[styles.emptySubtitle, { color: c.muted }]}>
                  Add some transactions to see your spending breakdown.
                </Text>
              </View>
            )}

            {/* ── Account balances ── */}
            {accountBalances.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.muted, marginTop: space.lg }]}>
                  Account balances
                </Text>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
                  <AccountBalanceChart data={accountBalances} c={c} />
                </View>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint, marginTop: space.sm }]}>
                  {accountBalances.map((a, i) => (
                    <AccountBalanceRow key={a.account_id} account={a} c={c} isLast={i === accountBalances.length - 1} />
                  ))}
                </View>
              </>
            )}

            {/* ── Account activity this period ── */}
            {accountActivity.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: c.muted, marginTop: space.lg }]}>
                  Activity by account
                </Text>
                <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.borderFaint }]}>
                  {accountActivity.map((a, i) => (
                    <AccountActivityRow key={a.account_id} account={a} c={c} isLast={i === accountActivity.length - 1} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, amount, color, bg, textColor, mutedColor }: {
  label: string; amount: number; color: string;
  bg: string; textColor: string; mutedColor: string;
}) {
  const { symbol } = useCurrency();
  return (
    <View style={[sc.card, { backgroundColor: bg }]}>
      <Text style={[sc.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[sc.amount, { color }]}>
        {amount < 0 ? "-" : ""}{symbol}{Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ data, c }: { data: MonthlySummary[]; c: ReturnType<typeof getColors> }) {
  const W = SCREEN_WIDTH - space.md * 2 - space.lg * 2;
  const H = 160;
  const barGroupW = W / data.length;
  const barW = barGroupW * 0.3;
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  const chartH = H - 40; // leave room for labels

  return (
    <Svg width={W} height={H}>
      {data.map((d, i) => {
        const x = i * barGroupW + barGroupW * 0.1;
        const incH = (d.income / maxVal) * chartH;
        const expH = (d.expenses / maxVal) * chartH;
        return (
          <G key={d.month}>
            {/* Income bar */}
            <Rect
              x={x} y={chartH - incH} width={barW} height={incH}
              fill={c.positive} rx={3} opacity={0.85}
            />
            {/* Expense bar */}
            <Rect
              x={x + barW + 4} y={chartH - expH} width={barW} height={expH}
              fill={c.negative} rx={3} opacity={0.85}
            />
            {/* Month label */}
            <SvgText
              x={x + barW} y={H - 6}
              textAnchor="middle" fontSize={11} fill={c.muted}
            >
              {d.label.split(" ")[0]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, c }: { data: CategorySpend[]; c: ReturnType<typeof getColors> }) {
  const { symbol } = useCurrency();
  const SIZE = 180;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 70;
  const r = 42; // inner radius (donut hole)

  const total = data.reduce((sum, d) => sum + d.total, 0);
  let startAngle = -Math.PI / 2;

  const COLORS = [
    "#C8A86A", "#F87171", "#4ADE80", "#60A5FA", "#A78BFA",
    "#F472B6", "#FBBF24", "#34D399", "#38BDF8", "#818CF8",
  ];

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function arcPath(start: number, end: number): string {
    const s = polarToXY(start, R);
    const e = polarToXY(end, R);
    const si = polarToXY(start, r);
    const ei = polarToXY(end, r);
    const large = end - start > Math.PI ? 1 : 0;
    return [
      `M ${s.x} ${s.y}`,
      `A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`,
      `L ${ei.x} ${ei.y}`,
      `A ${r} ${r} 0 ${large} 0 ${si.x} ${si.y}`,
      "Z",
    ].join(" ");
  }

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={SIZE} height={SIZE}>
        {data.map((d, i) => {
          const slice = (d.total / total) * 2 * Math.PI;
          const endAngle = startAngle + slice;
          const path = arcPath(startAngle, endAngle);
          startAngle = endAngle;
          return (
            <Path
              key={d.category_id}
              d={path}
              fill={d.category_color ?? COLORS[i % COLORS.length]}
              opacity={0.9}
            />
          );
        })}
        {/* Center text */}
        <SvgText x={cx} y={cy - 8} textAnchor="middle" fontSize={13} fill={c.muted}>Total</SvgText>
        <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={15} fontWeight="bold" fill={c.text}>
          {symbol}{total.toFixed(0)}
        </SvgText>
      </Svg>
    </View>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, c, isLast }: {
  cat: CategorySpend; c: ReturnType<typeof getColors>; isLast: boolean;
}) {
  const { symbol } = useCurrency();
  const COLORS = [
    "#C8A86A", "#F87171", "#4ADE80", "#60A5FA", "#A78BFA",
    "#F472B6", "#FBBF24", "#34D399", "#38BDF8", "#818CF8",
  ];
  const color = cat.category_color ?? COLORS[0];

  return (
    <View style={[cr.row, !isLast && { borderBottomWidth: 1, borderBottomColor: c.borderFaint }]}>
      <View style={[cr.dot, { backgroundColor: color }]} />
      <CategoryIcon name={cat.category_name} emoji={cat.category_icon} size={18} color={color} />
      <Text style={[cr.name, { color: c.text }]}>{cat.category_name}</Text>
      <View style={cr.right}>
        <Text style={[cr.pct, { color: c.muted }]}>{cat.percentage}%</Text>
        <Text style={[cr.amount, { color: c.text }]}>{symbol}{cat.total.toFixed(2)}</Text>
      </View>
    </View>
  );
}

// ─── Account balance chart (horizontal bars) ─────────────────────────────────

function AccountBalanceChart({ data, c }: { data: AccountBalance[]; c: ReturnType<typeof getColors> }) {
  const { symbol } = useCurrency();
  const W = SCREEN_WIDTH - space.md * 2 - space.lg * 2;
  const maxAbs = Math.max(...data.map((a) => Math.abs(a.balance)), 1);

  return (
    <View style={{ gap: space.sm }}>
      {data.map((a) => {
        const pct = Math.min(Math.abs(a.balance) / maxAbs, 1);
        const isNeg = a.balance < 0;
        const color = a.exclude_from_total ? c.muted : isNeg ? c.negative : c.positive;
        return (
          <View key={a.account_id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <AccountTypeIcon type={a.account_type} size={14} color={c.text} />
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
                  {a.account_name}{a.exclude_from_total ? " (excl.)" : ""}
                </Text>
              </View>
              <Text style={{ color, fontSize: 13, fontWeight: "700" }}>
                {isNeg ? "-" : ""}{symbol}{Math.abs(a.balance).toFixed(2)}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: c.elevated, borderRadius: radius.full, overflow: "hidden" }}>
              <View style={{ height: 8, width: `${pct * 100}%` as any, backgroundColor: color, borderRadius: radius.full }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Account balance row ──────────────────────────────────────────────────────

function AccountBalanceRow({ account: a, c, isLast }: {
  account: AccountBalance; c: ReturnType<typeof getColors>; isLast: boolean;
}) {
  const { symbol } = useCurrency();
  const isNeg = a.balance < 0;
  return (
    <View style={[cr.row, !isLast && { borderBottomWidth: 1, borderBottomColor: c.borderFaint }]}>
      <AccountTypeIcon type={a.account_type} size={16} color={c.text} />
      <View style={{ flex: 1 }}>
        <Text style={[cr.name, { color: c.text }]}>{a.account_name}</Text>
        {a.exclude_from_total ? <Text style={{ fontSize: 11, color: c.muted }}>Excluded from total</Text> : null}
      </View>
      <Text style={[cr.amount, { color: isNeg ? c.negative : c.positive }]}>
        {isNeg ? "-" : ""}{symbol}{Math.abs(a.balance).toFixed(2)}
      </Text>
    </View>
  );
}

// ─── Account activity row ─────────────────────────────────────────────────────

function AccountActivityRow({ account: a, c, isLast }: {
  account: AccountActivity; c: ReturnType<typeof getColors>; isLast: boolean;
}) {
  const { symbol } = useCurrency();
  return (
    <View style={[cr.row, { alignItems: "flex-start" }, !isLast && { borderBottomWidth: 1, borderBottomColor: c.borderFaint }]}>
      <AccountTypeIcon type={a.account_type} size={16} color={c.text} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[cr.name, { color: c.text, marginBottom: 4 }]}>{a.account_name}</Text>
        <View style={{ flexDirection: "row", gap: space.md }}>
          {a.income > 0 && (
            <Text style={{ fontSize: 12, color: c.positive }}>+{symbol}{a.income.toFixed(2)}</Text>
          )}
          {a.expenses > 0 && (
            <Text style={{ fontSize: 12, color: c.negative }}>-{symbol}{a.expenses.toFixed(2)}</Text>
          )}
        </View>
      </View>
      <Text style={[cr.amount, { color: a.net >= 0 ? c.positive : c.negative }]}>
        {a.net >= 0 ? "+" : ""}{symbol}{a.net.toFixed(2)}
      </Text>
    </View>
  );
}



const styles = StyleSheet.create({
  title:         { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: space.md },
  tabRow:        { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  tab:           { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", borderWidth: 1 },
  tabText:       { fontSize: 13, fontWeight: "600" },
  monthChip:     { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1 },
  monthChipText: { fontSize: 13, fontWeight: "500" },
  sectionLabel:  { fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: space.sm },
  summaryRow:    { flexDirection: "row", gap: space.sm },
  chartCard:     { borderRadius: radius.md, padding: space.md, borderWidth: 1 },
  empty:         { alignItems: "center", paddingVertical: space.xxl },
  emptyIcon:     { fontSize: 48, marginBottom: space.md },
  emptyIconImg:  { width: 64, height: 64, marginBottom: space.md },
  emptyTitle:    { fontSize: 18, fontWeight: "600", marginBottom: space.sm },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
});

const sc = StyleSheet.create({
  card:   { flex: 1, borderRadius: radius.md, padding: space.md, alignItems: "center" },
  label:  { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: space.xs },
  amount: { fontSize: 15, fontWeight: "700", textAlign: "center" },
});

const cr = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", paddingVertical: space.sm, gap: space.sm },
  dot:    { width: 10, height: 10, borderRadius: 5 },
  icon:   { fontSize: 16 },
  name:   { flex: 1, fontSize: 14, fontWeight: "500" },
  right:  { alignItems: "flex-end" },
  pct:    { fontSize: 12 },
  amount: { fontSize: 14, fontWeight: "600" },
});