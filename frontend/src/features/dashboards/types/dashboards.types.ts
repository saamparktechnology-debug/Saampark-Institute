export interface NavGroupItem {
  label: string;
  key: string;
  href: string;
  badge?: string;
}

export interface NavSection {
  heading: string;
  items: NavGroupItem[];
}

export interface ChartLabelValue {
  label: string;
  value: number;
  color?: string;
}

export interface StackedSeriesPoint {
  label: string;
  segments: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }>;
}

export interface HeatmapCellPoint {
  rowLabel: string;
  colLabel: string;
  value: number;
}

export interface SunburstNodeDto {
  label: string;
  value: number;
  color: string;
  children?: Array<{
    label: string;
    value: string | number;
    color: string;
  }>;
}

export interface AdminSummaryData {
  kpis: {
    totalUsers: number;
    userGrowthPercent: number;
    activeLiveClasses: number;
    revenueTodayInr: string;
    systemHealthPercent: number;
  };
  growthTrends: Array<{ month: string; users: number; revenueInr: number }>;
  systemAlerts: Array<{
    id: string;
    severity: 'AMBER' | 'GREEN' | 'RED';
    title: string;
    description: string;
    badgeText: string;
  }>;
  liveAuditLogs: Array<{
    id: string;
    actorLabel: string;
    event: string;
    timestamp: string;
    operator: string;
    status: string;
  }>;
  analyticsCharts?: {
    roleDistribution: ChartLabelValue[];
    enrollmentStatusBreakdown: ChartLabelValue[];
    financialTreasurySplit: ChartLabelValue[];
    courseRevenueAndInstallments: StackedSeriesPoint[];
    cashflowStackedTrend: Array<{
      label: string;
      capturedInr: number;
      payoutsInr: number;
      redemptionsInr: number;
    }>;
    auditActivityHeatmap: HeatmapCellPoint[];
    revenueSunburst: Array<{
      label: string;
      value: number;
      color: string;
      children?: Array<{ label: string; value: number; color: string }>;
    }>;
    platformHealthRadar: ChartLabelValue[];
  };
}

export interface StudentSummaryData {
  studentProfile: {
    fullName: string;
    studentCode: string;
    walletAvailableInr: string;
    referralCode: string;
    attendancePercent: number;
  };
  submissionCountdowns: Array<{
    assignmentId: string;
    title: string;
    courseTitle: string;
    dueAt: string;
    remainingFormatted: string;
  }>;
  enrolledCourses: Array<{
    enrollmentId: string;
    courseId: string;
    title: string;
    subtitle: string;
    progressPercent: number;
    status: string;
    nextLiveClassAt: string | null;
  }>;
  upcomingInstallments: Array<{
    installmentId: string;
    courseTitle: string;
    sequenceNumber: number;
    amountInr: string;
    dueAt: string;
    status: string;
  }>;
  analyticsCharts?: {
    feeBreakdownDonut: ChartLabelValue[];
    attendanceBreakdownPie: ChartLabelValue[];
    courseInstallmentStacked: StackedSeriesPoint[];
    assessmentScoresComparison: ChartLabelValue[];
    scoreTrajectoryLine: Array<{ label: string; scorePercent: number; passThreshold: number }>;
    studyEngagementArea: Array<{ label: string; liveMinutes: number; materialCount: number }>;
    walletLedgerStackedArea: Array<{
      label: string;
      creditsInr: number;
      debitsInr: number;
      reservedInr: number;
    }>;
    weeklyAttendanceHeatmap: HeatmapCellPoint[];
    learningHierarchySunburst: Array<{
      label: string;
      value: number;
      color: string;
      children?: Array<{ label: string; value: number; color: string }>;
    }>;
    masteryRadar: ChartLabelValue[];
  };
}

export interface TeacherSummaryData {
  kpis: {
    assignedStudentsCount: number;
    averageGradeLabel: string;
    nextClassTitle: string;
    nextClassStartsInMinutes: number;
    todayAttendancePercent: number;
  };
  todaySchedule: Array<{
    liveClassId: string;
    courseId: string;
    timeLabel: string;
    courseTitle: string;
    gradeLabel: string;
    status: string;
  }>;
  gradingQueues: Array<{
    assignmentId: string;
    title: string;
    courseTitle: string;
    pendingFilesCount: number;
  }>;
  studentPerformance: Array<{
    studentId: string;
    fullName: string;
    handle: string;
    statusLabel: 'Critical' | 'Excellent' | 'On Track';
    scorePercent: number;
  }>;
  semesterScoreTrend: Array<{ label: string; averageScore: number }>;
  analyticsCharts?: {
    submissionStatusDonut: ChartLabelValue[];
    cohortBandPie: ChartLabelValue[];
    courseAttendanceStacked: StackedSeriesPoint[];
    courseRevenueShareBar: ChartLabelValue[];
    submissionsStackedArea: Array<{
      label: string;
      gradedCount: number;
      pendingCount: number;
      lateCount: number;
    }>;
    courseEngagementHeatmap: HeatmapCellPoint[];
    teachingSunburst: Array<{
      label: string;
      value: number;
      color: string;
      children?: Array<{ label: string; value: number; color: string }>;
    }>;
    cockpitRadar: ChartLabelValue[];
  };
}

export interface SupportSummaryData {
  kpis: {
    slaBreachRiskCount: number;
    unassignedTicketsCount: number;
    averageHandleTimeLabel: string;
    activeAgentsCount: number;
  };
  ticketQueues: {
    incoming: Array<{
      ticketId: string;
      ticketNumber: string;
      subject: string;
      ageLabel: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT_RED';
      categoryLabel: string;
    }>;
    inTriage: Array<{
      ticketId: string;
      ticketNumber: string;
      subject: string;
      ageLabel: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT_RED';
      categoryLabel: string;
    }>;
    escalated: Array<{
      ticketId: string;
      ticketNumber: string;
      subject: string;
      ageLabel: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT_RED';
      categoryLabel: string;
    }>;
  };
  liveEscalationMonitor: {
    ticketNumber: string;
    agedHours: number;
    escalatedTo: string;
    progressHours: number;
  };
  activityFeed: Array<{
    id: string;
    summary: string;
    timestamp: string;
    operator: string;
    badge: string;
  }>;
  analyticsCharts?: {
    statusDistributionDonut: ChartLabelValue[];
    priorityDistributionPie: ChartLabelValue[];
    categoryVolumeColumn: ChartLabelValue[];
    categoryStatusStackedBar: StackedSeriesPoint[];
    agentWorkloadBar: ChartLabelValue[];
    commActivityStackedArea: Array<{
      label: string;
      publicReplies: number;
      internalNotes: number;
      escalations: number;
    }>;
    categoryPriorityHeatmap: HeatmapCellPoint[];
    supportHierarchySunburst: Array<{
      label: string;
      value: number;
      color: string;
      children?: Array<{ label: string; value: number; color: string }>;
    }>;
    slaComplianceRadar: ChartLabelValue[];
  };
}
