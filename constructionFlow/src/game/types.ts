export type EmployeeRole = 'laborer' | 'operator' | 'foreman' | 'projectManager' | 'mechanic';
export type EquipmentType = 'excavator' | 'skidSteer' | 'dumpTruck' | 'dozer' | 'crane' | 'loader';
export type JobType = 'sitePrep' | 'grading' | 'excavation' | 'demolition' | 'utility' | 'foundation';

export type Employee = {
  id: string;
  name: string;
  role: EmployeeRole;
  skill: number;
  morale: number;
  reliability: number;
  wagePerDay: number;
  active: boolean;
};

export type Equipment = {
  id: string;
  name: string;
  type: EquipmentType;
  purchasePrice: number;
  value: number;
  condition: number;
  maintenancePerDay: number;
  productivity: number;
  operational: boolean;
};

export type Job = {
  id: string;
  title: string;
  type: JobType;
  contractValue: number;
  estimatedDays: number;
  daysRemaining: number;
  difficulty: number;
  reputationRequired: number;
  status: 'available' | 'active' | 'completed' | 'failed';
};

export type Loan = {
  id: string;
  principalRemaining: number;
  annualInterestRate: number;
  dailyPayment: number;
  missedPayments: number;
  status: 'active' | 'paidOff' | 'defaulted';
};

export type Finance = {
  cash: number;
  totalRevenue: number;
  totalExpenses: number;
  totalDebt: number;
  creditScore: number;
};

export type Market = {
  day: number;
  fuelIndex: number;
  laborIndex: number;
  constructionIndex: number;
  materialIndex: number;
};

export type GameEvent = {
  id: string;
  day: number;
  title: string;
  description: string;
  cashImpact: number;
  reputationImpact: number;
};

export type GameState = {
  day: number;
  reputation: number;
  finance: Finance;
  market: Market;
  employees: Employee[];
  equipment: Equipment[];
  jobs: Job[];
  activeJobId: string | null;
  loans: Loan[];
  events: GameEvent[];
};
