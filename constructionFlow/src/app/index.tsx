import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EQUIPMENT_CATALOG,
  acceptJob,
  buyEquipment,
  createInitialGameState,
  formatMoney,
  hireEmployee,
  simulateDay,
} from '@/game/engine';

export default function HomeScreen() {
  const [game, setGame] = useState(createInitialGameState);
  const activeJob = useMemo(() => game.jobs.find((job) => job.id === game.activeJobId) ?? null, [game]);
  const availableJobs = game.jobs.filter((job) => job.status === 'available').slice(0, 4);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>WILDBEAR</Text>
            <Text style={styles.title}>Construction Flow</Text>
            <Text style={styles.subtitle}>Day {game.day} · Reputation {Math.round(game.reputation)}</Text>
          </View>
          <View style={styles.cashCard}>
            <Text style={styles.cashLabel}>CASH</Text>
            <Text style={styles.cash}>{formatMoney(game.finance.cash)}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Revenue" value={formatMoney(game.finance.totalRevenue)} />
          <Metric label="Expenses" value={formatMoney(game.finance.totalExpenses)} />
          <Metric label="Credit" value={String(game.finance.creditScore)} />
        </View>

        <Section title="Active Job">
          {activeJob ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{activeJob.title}</Text>
              <Text style={styles.cardText}>{formatMoney(activeJob.contractValue)} contract</Text>
              <Text style={styles.cardText}>{activeJob.daysRemaining.toFixed(1)} days remaining</Text>
            </View>
          ) : (
            <Text style={styles.empty}>No active job. Pick a contract below.</Text>
          )}
          <Action title="Advance One Day" onPress={() => setGame((current) => simulateDay(current))} />
        </Section>

        <Section title="Available Contracts">
          {availableJobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <Text style={styles.cardTitle}>{job.title}</Text>
              <Text style={styles.cardText}>{formatMoney(job.contractValue)} · {job.estimatedDays} days</Text>
              <Text style={styles.cardText}>Difficulty {job.difficulty} · Requires rep {job.reputationRequired}</Text>
              <Action
                title={game.activeJobId ? 'Finish Current Job First' : 'Accept Contract'}
                disabled={Boolean(game.activeJobId)}
                onPress={() => setGame((current) => acceptJob(current, job.id))}
              />
            </View>
          ))}
        </Section>

        <Section title="Crew">
          <Text style={styles.empty}>{game.employees.length} employees on payroll</Text>
          <View style={styles.buttonRow}>
            <SmallAction title="Hire Laborer" onPress={() => setGame((current) => hireEmployee(current, 'laborer'))} />
            <SmallAction title="Hire Operator" onPress={() => setGame((current) => hireEmployee(current, 'operator'))} />
          </View>
          {game.employees.slice(-3).reverse().map((employee) => (
            <View key={employee.id} style={styles.listRow}>
              <View>
                <Text style={styles.cardTitle}>{employee.name}</Text>
                <Text style={styles.cardText}>{employee.role} · Skill {employee.skill}</Text>
              </View>
              <Text style={styles.cost}>{formatMoney(employee.wagePerDay)}/day</Text>
            </View>
          ))}
        </Section>

        <Section title="Equipment Yard">
          {game.equipment.map((equipment) => (
            <View key={equipment.id} style={styles.listRow}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{equipment.name}</Text>
                <Text style={styles.cardText}>Condition {Math.round(equipment.condition)}% · Value {formatMoney(equipment.value)}</Text>
              </View>
              <Text style={equipment.operational ? styles.good : styles.bad}>{equipment.operational ? 'READY' : 'DOWN'}</Text>
            </View>
          ))}
          {EQUIPMENT_CATALOG.map((equipment) => (
            <SmallAction
              key={equipment.name}
              title={`Buy ${equipment.name} · ${formatMoney(equipment.purchasePrice)}`}
              onPress={() => setGame((current) => buyEquipment(current, equipment))}
            />
          ))}
        </Section>

        <Section title="Market">
          <View style={styles.metricsRow}>
            <Metric label="Fuel" value={`${game.market.fuelIndex.toFixed(2)}x`} />
            <Metric label="Labor" value={`${game.market.laborIndex.toFixed(2)}x`} />
            <Metric label="Construction" value={`${game.market.constructionIndex.toFixed(2)}x`} />
          </View>
        </Section>

        <Section title="Event Log">
          {game.events.length === 0 ? <Text style={styles.empty}>Quiet so far. That will change.</Text> : null}
          {game.events.slice(0, 5).map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardText}>{event.description}</Text>
            </View>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.actionDisabled]}>
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

function SmallAction({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.smallAction}>
      <Text style={styles.smallActionText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b1118' },
  container: { padding: 18, gap: 18, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { color: '#f59e0b', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#94a3b8', marginTop: 4, fontSize: 14 },
  cashCard: { backgroundColor: '#111c28', borderWidth: 1, borderColor: '#203246', borderRadius: 16, padding: 12, alignItems: 'flex-end' },
  cashLabel: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  cash: { color: '#22c55e', fontSize: 20, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#111c28', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e2c3a' },
  metricLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  metricValue: { color: '#e2e8f0', fontSize: 16, fontWeight: '800', marginTop: 3 },
  section: { gap: 10 },
  sectionTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: '#111c28', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e2c3a', gap: 4 },
  cardTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 15 },
  cardText: { color: '#94a3b8', fontSize: 13 },
  empty: { color: '#64748b', fontSize: 14 },
  action: { marginTop: 8, backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  actionDisabled: { opacity: 0.35 },
  actionText: { color: '#111827', fontWeight: '900' },
  buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallAction: { backgroundColor: '#1d2a39', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2c4055' },
  smallActionText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  listRow: { backgroundColor: '#111c28', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: '#1e2c3a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  cost: { color: '#f59e0b', fontWeight: '800', fontSize: 12 },
  good: { color: '#22c55e', fontWeight: '900', fontSize: 11 },
  bad: { color: '#ef4444', fontWeight: '900', fontSize: 11 },
});
