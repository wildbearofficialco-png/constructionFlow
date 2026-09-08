import type { Employee, Equipment, GameEvent, GameState, Job, JobType } from './types';

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const random = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (probability: number) => Math.random() < probability;

export function createInitialGameState(): GameState {
  return {
    day: 1,
    reputation: 50,
    finance: { cash: 50000, totalRevenue: 0, totalExpenses: 0, totalDebt: 0, creditScore: 680 },
    market: { day: 1, fuelIndex: 1, laborIndex: 1, constructionIndex: 1, materialIndex: 1 },
    employees: [],
    equipment: [
      {
        id: id('equip'),
        name: 'Used Skid Steer',
        type: 'skidSteer',
        purchasePrice: 18000,
        value: 18000,
        condition: 88,
        maintenancePerDay: 28,
        productivity: 1,
        operational: true,
      },
    ],
    jobs: generateJobs(50),
    activeJobId: null,
    loans: [],
    events: [],
  };
}

export function hireEmployee(state: GameState, role: Employee['role']): GameState {
  const wageBase: Record<Employee['role'], number> = {
    laborer: 180,
    operator: 245,
    foreman: 310,
    projectManager: 390,
    mechanic: 260,
  };
  const employee: Employee = {
    id: id('emp'),
    name: randomEmployeeName(),
    role,
    skill: Math.round(random(40, 82)),
    morale: Math.round(random(58, 88)),
    reliability: Math.round(random(55, 94)),
    wagePerDay: roundMoney(wageBase[role] * state.market.laborIndex),
    active: true,
  };
  return { ...state, employees: [...state.employees, employee] };
}

export function acceptJob(state: GameState, jobId: string): GameState {
  if (state.activeJobId) return state;
  const job = state.jobs.find((candidate) => candidate.id === jobId);
  if (!job || job.status !== 'available' || state.reputation < job.reputationRequired) return state;
  return {
    ...state,
    activeJobId: jobId,
    jobs: state.jobs.map((candidate) => (candidate.id === jobId ? { ...candidate, status: 'active' } : candidate)),
  };
}

export function simulateDay(state: GameState): GameState {
  const market = advanceMarket(state);
  const payroll = state.employees.filter((employee) => employee.active).reduce((sum, employee) => sum + employee.wagePerDay * market.laborIndex, 0);
  const maintenance = state.equipment.reduce((sum, equipment) => sum + equipment.maintenancePerDay, 0);
  const fuel = state.equipment.filter((equipment) => equipment.operational).length * 34 * market.fuelIndex;
  const materials = state.activeJobId ? 125 * market.materialIndex : 0;
  const operatingCost = roundMoney(payroll + maintenance + fuel + materials);

  let finance = {
    ...state.finance,
    cash: roundMoney(state.finance.cash - operatingCost),
    totalExpenses: roundMoney(state.finance.totalExpenses + operatingCost),
  };

  let reputation = state.reputation;
  let jobs = state.jobs;
  let activeJobId = state.activeJobId;
  let events = [...state.events];

  const equipment = state.equipment.map((item) => {
    const condition = clamp(item.condition - random(0.1, 0.6), 0, 100);
    return {
      ...item,
      condition,
      value: roundMoney(item.value * 0.999),
      operational: condition > 15,
    };
  });

  if (activeJobId) {
    const activeJob = jobs.find((job) => job.id === activeJobId);
    if (activeJob) {
      const productivity = calculateProductivity(state.employees, equipment);
      const progress = productivity >= activeJob.difficulty ? 1 : productivity >= activeJob.difficulty * 0.7 ? 0.75 : 0.5;
      const nextRemaining = Math.max(0, activeJob.daysRemaining - progress);
      if (nextRemaining <= 0) {
        finance = {
          ...finance,
          cash: roundMoney(finance.cash + activeJob.contractValue),
          totalRevenue: roundMoney(finance.totalRevenue + activeJob.contractValue),
        };
        reputation = clamp(reputation + Math.max(2, Math.round(activeJob.difficulty / 12)), 0, 100);
        jobs = jobs.map((job) => (job.id === activeJobId ? { ...job, daysRemaining: 0, status: 'completed' } : job));
        activeJobId = null;
        events = [makeEvent(state.day + 1, 'Job Complete', `${activeJob.title} finished and paid ${formatMoney(activeJob.contractValue)}.`, activeJob.contractValue, 3), ...events];
      } else {
        jobs = jobs.map((job) => (job.id === activeJobId ? { ...job, daysRemaining: nextRemaining } : job));
      }
    }
  }

  if (chance(0.055) && equipment.length > 0) {
    const target = equipment[Math.floor(Math.random() * equipment.length)];
    const repairCost = roundMoney(random(450, 2200));
    finance = { ...finance, cash: roundMoney(finance.cash - repairCost), totalExpenses: roundMoney(finance.totalExpenses + repairCost) };
    reputation = clamp(reputation - 1, 0, 100);
    events = [makeEvent(state.day + 1, 'Equipment Breakdown', `${target.name} broke down and needed an emergency repair.`, -repairCost, -1), ...events];
  }

  if (state.day % 3 === 0) {
    jobs = replenishJobs(jobs, reputation);
  }

  return {
    ...state,
    day: state.day + 1,
    market,
    finance,
    reputation,
    equipment,
    jobs,
    activeJobId,
    events: events.slice(0, 25),
  };
}

export function buyEquipment(state: GameState, template: Omit<Equipment, 'id' | 'value' | 'condition' | 'operational'>): GameState {
  if (state.finance.cash < template.purchasePrice) return state;
  const equipment: Equipment = {
    ...template,
    id: id('equip'),
    value: template.purchasePrice,
    condition: 100,
    operational: true,
  };
  return {
    ...state,
    finance: {
      ...state.finance,
      cash: roundMoney(state.finance.cash - template.purchasePrice),
      totalExpenses: roundMoney(state.finance.totalExpenses + template.purchasePrice),
    },
    equipment: [...state.equipment, equipment],
  };
}

export const EQUIPMENT_CATALOG: Array<Omit<Equipment, 'id' | 'value' | 'condition' | 'operational'>> = [
  { name: 'Compact Excavator', type: 'excavator', purchasePrice: 32000, maintenancePerDay: 42, productivity: 1.25 },
  { name: 'Used Dump Truck', type: 'dumpTruck', purchasePrice: 41000, maintenancePerDay: 56, productivity: 1.2 },
  { name: 'Track Dozer', type: 'dozer', purchasePrice: 58000, maintenancePerDay: 70, productivity: 1.5 },
];

function calculateProductivity(employees: Employee[], equipment: Equipment[]) {
  const activeEmployees = employees.filter((employee) => employee.active);
  const peopleScore = activeEmployees.length === 0 ? 20 : activeEmployees.reduce((sum, employee) => sum + employee.skill * (employee.morale / 100) * (employee.reliability / 100), 0) / activeEmployees.length;
  const equipmentScore = equipment.filter((item) => item.operational).reduce((sum, item) => sum + item.productivity * (item.condition / 100) * 30, 0);
  return peopleScore + equipmentScore;
}

function advanceMarket(state: GameState) {
  return {
    day: state.market.day + 1,
    fuelIndex: clamp(state.market.fuelIndex + random(-0.035, 0.04), 0.72, 1.6),
    laborIndex: clamp(state.market.laborIndex + random(-0.02, 0.025), 0.82, 1.45),
    constructionIndex: clamp(state.market.constructionIndex + random(-0.05, 0.06), 0.55, 1.8),
    materialIndex: clamp(state.market.materialIndex + random(-0.04, 0.05), 0.7, 1.7),
  };
}

function generateJobs(reputation: number): Job[] {
  const types: Array<{ type: JobType; title: string; base: number; days: number; difficulty: number }> = [
    { type: 'sitePrep', title: 'Residential Site Prep', base: 6800, days: 3, difficulty: 38 },
    { type: 'grading', title: 'Commercial Lot Grading', base: 12500, days: 5, difficulty: 50 },
    { type: 'excavation', title: 'Foundation Excavation', base: 17400, days: 6, difficulty: 58 },
    { type: 'demolition', title: 'Small Structure Demolition', base: 22000, days: 7, difficulty: 66 },
    { type: 'utility', title: 'Utility Trench Package', base: 9800, days: 4, difficulty: 48 },
    { type: 'foundation', title: 'Foundation Earthwork', base: 28500, days: 8, difficulty: 72 },
  ];
  return types.slice(0, 4).map((template) => ({
    id: id('job'),
    title: template.title,
    type: template.type,
    contractValue: roundMoney(template.base * random(0.9, 1.18)),
    estimatedDays: template.days,
    daysRemaining: template.days,
    difficulty: template.difficulty,
    reputationRequired: Math.max(0, Math.round(template.difficulty - 25)),
    status: 'available',
  })).filter((job) => job.reputationRequired <= reputation + 20);
}

function replenishJobs(existing: Job[], reputation: number) {
  const keep = existing.filter((job) => job.status === 'active' || job.status === 'completed');
  return [...keep, ...generateJobs(reputation)];
}

function makeEvent(day: number, title: string, description: string, cashImpact: number, reputationImpact: number): GameEvent {
  return { id: id('event'), day, title, description, cashImpact, reputationImpact };
}

function randomEmployeeName() {
  const first = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie'];
  const last = ['Reed', 'Stone', 'Carter', 'Brooks', 'Hayes', 'Rivera', 'Bennett', 'Parker'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

export const formatMoney = (value: number) => `$${Math.round(value).toLocaleString()}`;
