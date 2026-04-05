"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { createClient } from "@/lib/supabase/client";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const flowLevels = ["Light", "Medium", "Heavy"] as const;
const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const moodStickerOptions = [
  { value: "Happy", emoji: "😊", label: "Happy" },
  { value: "Calm", emoji: "🌷", label: "Calm" },
  { value: "Sensitive", emoji: "🫶", label: "Sensitive" },
  { value: "Low", emoji: "😴", label: "Low" },
  { value: "Anxious", emoji: "🥺", label: "Anxious" },
] as const;
const dailyAffirmations = [
  "You are doing your best today, and that is enough.",
  "Your body is wise and worthy of care.",
  "Small daily notes become powerful self-knowledge.",
  "Rest is productive too.",
  "You deserve softness and patience today.",
];
const milestoneTargets = [3, 5, 7, 10, 20, 30] as const;
const confettiEmojis = ["💖", "✨", "🌸", "💫", "🩷", "🎀"] as const;
const themeEmojiMap: Record<string, string> = {
  "cotton-candy": "🍭",
  "rose-milk": "🌹",
  "peach-bloom": "🍑",
  lilac: "🪻",
};

const themePresets = {
  "cotton-candy": {
    label: "Cotton candy",
    vars: {
      "--background": "#fff8fd",
      "--foreground": "#4a2740",
      "--surface": "#ffffff",
      "--surface-soft": "#ffeef8",
      "--surface-strong": "#ffd6eb",
      "--primary": "#db4a95",
      "--primary-soft": "#f17eb4",
      "--accent": "#b55b9f",
      "--ring": "#f5a8cf",
      "--border": "#f4bfdc",
      "--shadow": "219 74 149",
    },
    background:
      "radial-gradient(circle at 15% 10%, #ffc3e1 0%, transparent 35%), radial-gradient(circle at 85% 18%, #ffd8ef 0%, transparent 40%), linear-gradient(160deg, #fff8fd 0%, #fff2fa 45%, #ffeef8 100%)",
  },
  "rose-milk": {
    label: "Rose milk",
    vars: {
      "--background": "#fff7fb",
      "--foreground": "#4b2438",
      "--surface": "#ffffff",
      "--surface-soft": "#fff0f7",
      "--surface-strong": "#ffddea",
      "--primary": "#d84a8d",
      "--primary-soft": "#ea76ac",
      "--accent": "#af4f8b",
      "--ring": "#f4a8ca",
      "--border": "#f7c7df",
      "--shadow": "216 75 141",
    },
    background:
      "radial-gradient(circle at 10% 8%, #ffd2ea 0%, transparent 38%), radial-gradient(circle at 80% 15%, #ffe7f2 0%, transparent 42%), linear-gradient(170deg, #fff9fc 0%, #fff1f8 52%, #ffeaf4 100%)",
  },
  "peach-bloom": {
    label: "Peach bloom",
    vars: {
      "--background": "#fff9f4",
      "--foreground": "#5b3040",
      "--surface": "#ffffff",
      "--surface-soft": "#fff3ea",
      "--surface-strong": "#ffdccc",
      "--primary": "#ff7a8f",
      "--primary-soft": "#ff9ab0",
      "--accent": "#ca617e",
      "--ring": "#ffb7c7",
      "--border": "#ffd3d9",
      "--shadow": "255 122 143",
    },
    background:
      "radial-gradient(circle at 16% 7%, #ffd9c7 0%, transparent 36%), radial-gradient(circle at 82% 16%, #ffe4da 0%, transparent 44%), linear-gradient(162deg, #fffaf6 0%, #fff2eb 50%, #ffeae2 100%)",
  },
  lilac: {
    label: "Lilac cloud",
    vars: {
      "--background": "#faf7ff",
      "--foreground": "#472f5f",
      "--surface": "#ffffff",
      "--surface-soft": "#f2ecff",
      "--surface-strong": "#e3d7ff",
      "--primary": "#9a6aff",
      "--primary-soft": "#b38bff",
      "--accent": "#7a59c7",
      "--ring": "#c9b2ff",
      "--border": "#dccdff",
      "--shadow": "154 106 255",
    },
    background:
      "radial-gradient(circle at 14% 10%, #e5d7ff 0%, transparent 38%), radial-gradient(circle at 84% 19%, #f0e7ff 0%, transparent 40%), linear-gradient(165deg, #fbf8ff 0%, #f4efff 48%, #eee4ff 100%)",
  },
} as const;

type FlowLevel = (typeof flowLevels)[number];
type TrackerMode = "journal" | "calendar";
type ThemeId = keyof typeof themePresets;
type NotificationState = NotificationPermission | "unsupported";
type BottomTab = "journal" | "calendar" | "insights" | "share";

type CycleEntry = {
  id: string;
  startDate: string;
  endDate: string;
  periodLength: number;
  flow: FlowLevel;
  symptoms: string[];
  notes: string;
  createdAt: string;
};

type DailyLogEntry = {
  id: string;
  logDate: string;
  mood: string;
  painLevel: number | null;
  energyLevel: number | null;
  discharge: string;
  medications: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type TrackerPreferences = {
  cycleLength: number;
  periodLength: number;
  periodReminderDaysBefore: number;
  dailyLogReminderHour: number;
  notificationsEnabled: boolean;
};

type CycleForm = {
  startDate: string;
  periodLength: string;
  flow: FlowLevel;
  symptoms: string;
  notes: string;
};

type DailyLogForm = {
  mood: string;
  painLevel: string;
  energyLevel: string;
  discharge: string;
  medications: string;
  notes: string;
};

type ShareReportLink = {
  id: string;
  token: string;
  title: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
};

type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
};

type CycleRow = {
  id: string;
  start_date: string;
  end_date: string;
  period_length: number;
  flow: string;
  symptoms: string[] | null;
  notes: string | null;
  created_at: string;
};

type DailyLogRow = {
  id: string;
  log_date: string;
  mood: string | null;
  pain_level: number | null;
  energy_level: number | null;
  discharge: string | null;
  medications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PreferencesRow = {
  cycle_length: number;
  period_length: number;
  period_reminder_days_before: number;
  daily_log_reminder_hour: number;
  notifications_enabled: boolean;
};

type ShareRow = {
  id: string;
  token: string;
  title: string | null;
  range_start: string | null;
  range_end: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
};

type ConfettiPiece = {
  id: string;
  emoji: string;
  left: number;
  duration: number;
  delay: number;
};

const defaultPreferences: TrackerPreferences = {
  cycleLength: 28,
  periodLength: 5,
  periodReminderDaysBefore: 2,
  dailyLogReminderHour: 20,
  notificationsEnabled: false,
};

function toLocalDate(dateText: string) {
  return new Date(`${dateText}T00:00:00`);
}

function addDays(dateValue: Date, days: number) {
  const nextDate = new Date(dateValue);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateInput(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = `${dateValue.getMonth() + 1}`.padStart(2, "0");
  const day = `${dateValue.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateText() {
  return formatDateInput(new Date());
}

function addDaysToDateText(dateText: string, days: number) {
  return formatDateInput(addDays(toLocalDate(dateText), days));
}

function daysBetween(startDate: string, endDate: string) {
  return Math.round((toLocalDate(endDate).getTime() - toLocalDate(startDate).getTime()) / ONE_DAY_MS);
}

function formatDate(dateText: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toLocalDate(dateText));
}

function formatDateFromObject(dateValue: Date | null) {
  if (!dateValue) {
    return "Not enough data";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateValue);
}

function getMonthLabel(dateValue: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(dateValue);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSymptoms(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((symptom) => symptom.trim())
        .filter((symptom) => symptom.length > 0),
    ),
  );
}

function isFlowLevel(value: string): value is FlowLevel {
  return flowLevels.includes(value as FlowLevel);
}

function getAverageCycleLength(entries: CycleEntry[]) {
  if (entries.length < 2) {
    return null;
  }

  const sorted = [...entries].sort((a, b) => toLocalDate(a.startDate).getTime() - toLocalDate(b.startDate).getTime());

  const cycleGaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = daysBetween(sorted[index - 1].startDate, sorted[index].startDate);
    if (gap > 0) {
      cycleGaps.push(gap);
    }
  }

  if (!cycleGaps.length) {
    return null;
  }

  return clamp(Math.round(cycleGaps.reduce((sum, gap) => sum + gap, 0) / cycleGaps.length), 21, 40);
}

function getAveragePeriodLength(entries: CycleEntry[]) {
  if (!entries.length) {
    return null;
  }

  const lengths = entries.map((entry) => entry.periodLength).filter((length) => length > 0);
  if (!lengths.length) {
    return null;
  }

  return Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length);
}

function getTopSymptoms(entries: CycleEntry[], limit = 6) {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    entry.symptoms.forEach((symptom) => {
      const key = symptom.trim();
      if (!key) {
        return;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function isDateWithinRange(dateText: string, rangeStart: string | null, rangeEnd: string | null) {
  const time = toLocalDate(dateText).getTime();

  if (rangeStart && time < toLocalDate(rangeStart).getTime()) {
    return false;
  }

  if (rangeEnd && time > toLocalDate(rangeEnd).getTime()) {
    return false;
  }

  return true;
}

function cycleOverlapsRange(entry: CycleEntry, rangeStart: string | null, rangeEnd: string | null) {
  const start = toLocalDate(entry.startDate).getTime();
  const end = toLocalDate(entry.endDate).getTime();
  const rangeStartTime = rangeStart ? toLocalDate(rangeStart).getTime() : Number.NEGATIVE_INFINITY;
  const rangeEndTime = rangeEnd ? toLocalDate(rangeEnd).getTime() : Number.POSITIVE_INFINITY;

  return end >= rangeStartTime && start <= rangeEndTime;
}

function getCycleDay(dateText: string, entries: CycleEntry[]) {
  const targetTime = toLocalDate(dateText).getTime();
  const previousStarts = entries
    .filter((entry) => toLocalDate(entry.startDate).getTime() <= targetTime)
    .sort((a, b) => toLocalDate(b.startDate).getTime() - toLocalDate(a.startDate).getTime());

  if (!previousStarts.length) {
    return null;
  }

  const day = daysBetween(previousStarts[0].startDate, dateText) + 1;
  return day > 0 ? day : null;
}

function toNullableNumber(value: string, min: number, max: number) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clamp(Math.round(parsed), min, max);
}

function getEmptyDailyLogForm(): DailyLogForm {
  return {
    mood: "",
    painLevel: "",
    energyLevel: "",
    discharge: "",
    medications: "",
    notes: "",
  };
}

function isDailyLogFormEmpty(form: DailyLogForm) {
  return (
    !form.mood.trim() &&
    !form.painLevel.trim() &&
    !form.energyLevel.trim() &&
    !form.discharge.trim() &&
    !form.medications.trim() &&
    !form.notes.trim()
  );
}

function mapCycleRow(row: CycleRow): CycleEntry {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    periodLength: clamp(Math.round(row.period_length), 1, 14),
    flow: isFlowLevel(row.flow) ? row.flow : "Medium",
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

function mapDailyLogRow(row: DailyLogRow): DailyLogEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    mood: row.mood ?? "",
    painLevel: row.pain_level,
    energyLevel: row.energy_level,
    discharge: row.discharge ?? "",
    medications: row.medications ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPreferencesRow(row: PreferencesRow | null): TrackerPreferences {
  if (!row) {
    return defaultPreferences;
  }

  return {
    cycleLength: clamp(Math.round(row.cycle_length), 21, 40),
    periodLength: clamp(Math.round(row.period_length), 1, 14),
    periodReminderDaysBefore: clamp(Math.round(row.period_reminder_days_before), 1, 10),
    dailyLogReminderHour: clamp(Math.round(row.daily_log_reminder_hour), 0, 23),
    notificationsEnabled: Boolean(row.notifications_enabled),
  };
}

function mapShareRow(row: ShareRow): ShareReportLink {
  return {
    id: row.id,
    token: row.token,
    title: row.title ?? "Doctor read-only report",
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning, Anto";
  }
  if (hour < 18) {
    return "Good afternoon, Anto";
  }
  return "Good evening, Anto";
}

function getAffirmationForToday() {
  const today = new Date();
  const key = today.getFullYear() * 400 + (today.getMonth() + 1) * 32 + today.getDate();
  return dailyAffirmations[key % dailyAffirmations.length];
}

function getPhaseIcon(phaseLabel: string) {
  if (phaseLabel.toLowerCase().includes("period")) {
    return "🩸";
  }
  if (phaseLabel.toLowerCase().includes("fertile")) {
    return "🌸";
  }
  if (phaseLabel.toLowerCase().includes("ovulation")) {
    return "🌙";
  }
  return "✨";
}

function getMascot(phaseLabel: string) {
  if (phaseLabel.toLowerCase().includes("period")) {
    return { emoji: "🐻", name: "Cozy bear" };
  }
  if (phaseLabel.toLowerCase().includes("fertile")) {
    return { emoji: "🦋", name: "Bloom butterfly" };
  }
  if (phaseLabel.toLowerCase().includes("ovulation")) {
    return { emoji: "🦄", name: "Moon unicorn" };
  }
  return { emoji: "🐱", name: "Sparkle kitty" };
}

function getDailyLogStreak(dailyLogs: DailyLogEntry[], todayDateText: string) {
  const dateSet = new Set(dailyLogs.map((log) => log.logDate));
  let streak = 0;
  let cursorDate = toLocalDate(todayDateText);

  while (true) {
    const cursorText = formatDateInput(cursorDate);
    if (!dateSet.has(cursorText)) {
      break;
    }
    streak += 1;
    cursorDate = addDays(cursorDate, -1);
  }

  return streak;
}

export default function TrackerApp() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  const [mode, setMode] = useState<TrackerMode>("journal");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [preferences, setPreferences] = useState<TrackerPreferences>(defaultPreferences);
  const [shareLinks, setShareLinks] = useState<ShareReportLink[]>([]);

  const [selectedDateText, setSelectedDateText] = useState(getTodayDateText());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [formData, setFormData] = useState<CycleForm>({
    startDate: getTodayDateText(),
    periodLength: `${defaultPreferences.periodLength}`,
    flow: "Medium",
    symptoms: "",
    notes: "",
  });

  const [dailyLogForm, setDailyLogForm] = useState<DailyLogForm>(getEmptyDailyLogForm());
  const [pdfRangeStart, setPdfRangeStart] = useState("");
  const [pdfRangeEnd, setPdfRangeEnd] = useState("");
  const [shareTitle, setShareTitle] = useState("Doctor read-only report");
  const [shareExpiryDays, setShareExpiryDays] = useState("30");
  const [latestShareUrl, setLatestShareUrl] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationState>("unsupported");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("cotton-candy");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("journal");
  const [doctorMode, setDoctorMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);

  const reminderHistoryRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const [preferencesResponse, cyclesResponse, dailyLogsResponse, sharesResponse] = await Promise.all([
        supabase.from("cycle_preferences").select("*").maybeSingle(),
        supabase
          .from("cycles")
          .select("id, start_date, end_date, period_length, flow, symptoms, notes, created_at")
          .order("start_date", { ascending: false }),
        supabase
          .from("daily_logs")
          .select("id, log_date, mood, pain_level, energy_level, discharge, medications, notes, created_at, updated_at")
          .order("log_date", { ascending: false }),
        supabase
          .from("shared_reports")
          .select("id, token, title, range_start, range_end, expires_at, revoked, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (preferencesResponse.error) {
        setFeedbackMessage(preferencesResponse.error.message);
      }
      if (cyclesResponse.error) {
        setFeedbackMessage(cyclesResponse.error.message);
      }
      if (dailyLogsResponse.error) {
        setFeedbackMessage(dailyLogsResponse.error.message);
      }
      if (sharesResponse.error) {
        setFeedbackMessage(sharesResponse.error.message);
      }

      const preferencesRow = (preferencesResponse.data as PreferencesRow | null) ?? null;
      const nextPreferences = mapPreferencesRow(preferencesRow);

      if (!preferencesRow) {
        await supabase.from("cycle_preferences").upsert(
          {
            user_id: user.id,
            cycle_length: defaultPreferences.cycleLength,
            period_length: defaultPreferences.periodLength,
            period_reminder_days_before: defaultPreferences.periodReminderDaysBefore,
            daily_log_reminder_hour: defaultPreferences.dailyLogReminderHour,
            notifications_enabled: defaultPreferences.notificationsEnabled,
          },
          {
            onConflict: "user_id",
          },
        );
      }

      setPreferences(nextPreferences);
      setFormData((current) => ({
        ...current,
        periodLength: `${nextPreferences.periodLength}`,
      }));

      const cycleRows = (cyclesResponse.data ?? []) as CycleRow[];
      const dailyRows = (dailyLogsResponse.data ?? []) as DailyLogRow[];
      const shareRows = (sharesResponse.data ?? []) as ShareRow[];

      setCycles(cycleRows.map(mapCycleRow));
      setDailyLogs(dailyRows.map(mapDailyLogRow));
      setShareLinks(shareRows.map(mapShareRow));
      setIsDataReady(true);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!supabase || !isDataReady || !userId) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.from("cycle_preferences").upsert(
        {
          user_id: userId,
          cycle_length: preferences.cycleLength,
          period_length: preferences.periodLength,
          period_reminder_days_before: preferences.periodReminderDaysBefore,
          daily_log_reminder_hour: preferences.dailyLogReminderHour,
          notifications_enabled: preferences.notificationsEnabled,
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) {
        setFeedbackMessage("Could not save preferences right now.");
      }
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isDataReady, preferences, supabase, userId]);

  const sortedCycles = useMemo(
    () =>
      [...cycles].sort(
        (a, b) => toLocalDate(b.startDate).getTime() - toLocalDate(a.startDate).getTime(),
      ),
    [cycles],
  );

  const sortedDailyLogs = useMemo(
    () =>
      [...dailyLogs].sort((a, b) => toLocalDate(b.logDate).getTime() - toLocalDate(a.logDate).getTime()),
    [dailyLogs],
  );

  const dailyLogByDate = useMemo(
    () => new Map(dailyLogs.map((log) => [log.logDate, log] as const)),
    [dailyLogs],
  );

  useEffect(() => {
    if (!sortedCycles.length) {
      return;
    }

    const oldest = sortedCycles[sortedCycles.length - 1];
    const newest = sortedCycles[0];

    setPdfRangeStart((current) => current || oldest.startDate);
    setPdfRangeEnd((current) => current || newest.endDate);
  }, [sortedCycles]);

  const loggedAverageCycleLength = useMemo(() => getAverageCycleLength(cycles), [cycles]);
  const loggedAveragePeriodLength = useMemo(() => getAveragePeriodLength(cycles), [cycles]);

  const nextPredictedPeriod = useMemo(() => {
    if (!cycles.length) {
      return null;
    }

    const latestCycle = cycles.reduce((latest, current) =>
      toLocalDate(current.startDate).getTime() > toLocalDate(latest.startDate).getTime() ? current : latest,
    );

    return addDays(toLocalDate(latestCycle.startDate), preferences.cycleLength);
  }, [cycles, preferences.cycleLength]);

  const nextPredictedPeriodText = useMemo(
    () => (nextPredictedPeriod ? formatDateInput(nextPredictedPeriod) : null),
    [nextPredictedPeriod],
  );

  const predictedRangeLabel = useMemo(() => {
    if (!nextPredictedPeriodText) {
      return "Not enough history yet";
    }

    return `${formatDate(nextPredictedPeriodText)} - ${formatDate(
      addDaysToDateText(nextPredictedPeriodText, preferences.periodLength - 1),
    )}`;
  }, [nextPredictedPeriodText, preferences.periodLength]);

  const loggedPeriodDays = useMemo(() => {
    const periodDays = new Set<string>();
    cycles.forEach((cycle) => {
      for (let index = 0; index < cycle.periodLength; index += 1) {
        periodDays.add(addDaysToDateText(cycle.startDate, index));
      }
    });
    return periodDays;
  }, [cycles]);

  const predictedPeriodDays = useMemo(() => {
    const periodDays = new Set<string>();
    if (!nextPredictedPeriodText) {
      return periodDays;
    }

    for (let index = 0; index < preferences.periodLength; index += 1) {
      periodDays.add(addDaysToDateText(nextPredictedPeriodText, index));
    }

    return periodDays;
  }, [nextPredictedPeriodText, preferences.periodLength]);

  const ovulationDayText = useMemo(
    () => (nextPredictedPeriodText ? addDaysToDateText(nextPredictedPeriodText, -14) : null),
    [nextPredictedPeriodText],
  );

  const fertileWindowDays = useMemo(() => {
    const fertileDays = new Set<string>();
    if (!ovulationDayText) {
      return fertileDays;
    }

    for (let index = -5; index <= 0; index += 1) {
      fertileDays.add(addDaysToDateText(ovulationDayText, index));
    }

    return fertileDays;
  }, [ovulationDayText]);

  const selectedDateEntries = useMemo(
    () =>
      sortedCycles.filter((cycle) => {
        const day = toLocalDate(selectedDateText).getTime();
        return day >= toLocalDate(cycle.startDate).getTime() && day <= toLocalDate(cycle.endDate).getTime();
      }),
    [selectedDateText, sortedCycles],
  );

  const selectedDailyLog = useMemo(
    () => dailyLogs.find((log) => log.logDate === selectedDateText) ?? null,
    [dailyLogs, selectedDateText],
  );

  const selectedCycleDay = useMemo(() => getCycleDay(selectedDateText, cycles), [cycles, selectedDateText]);

  const selectedPhaseLabel = useMemo(() => {
    if (loggedPeriodDays.has(selectedDateText)) {
      return "Period day";
    }

    if (predictedPeriodDays.has(selectedDateText)) {
      return "Predicted period day";
    }

    if (ovulationDayText === selectedDateText) {
      return "Ovulation day";
    }

    if (fertileWindowDays.has(selectedDateText)) {
      return "Fertile window";
    }

    return "Cycle tracking day";
  }, [fertileWindowDays, loggedPeriodDays, ovulationDayText, predictedPeriodDays, selectedDateText]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const offsetToMonday = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -offsetToMonday);

    const days: CalendarDay[] = [];
    for (let index = 0; index < 42; index += 1) {
      const currentDate = addDays(gridStart, index);
      days.push({
        date: currentDate,
        inCurrentMonth: currentDate.getMonth() === calendarMonth.getMonth(),
      });
    }

    return days;
  }, [calendarMonth]);

  const estimatedEndDate = useMemo(() => {
    const parsedLength = Number(formData.periodLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 1) {
      return null;
    }

    return addDaysToDateText(formData.startDate, clamp(Math.round(parsedLength), 1, 14) - 1);
  }, [formData.periodLength, formData.startDate]);

  const filteredCyclesForReport = useMemo(
    () => sortedCycles.filter((cycle) => cycleOverlapsRange(cycle, pdfRangeStart || null, pdfRangeEnd || null)),
    [pdfRangeEnd, pdfRangeStart, sortedCycles],
  );

  const filteredDailyLogsForReport = useMemo(
    () =>
      sortedDailyLogs.filter((log) => isDateWithinRange(log.logDate, pdfRangeStart || null, pdfRangeEnd || null)),
    [pdfRangeEnd, pdfRangeStart, sortedDailyLogs],
  );

  const reportTopSymptoms = useMemo(() => getTopSymptoms(filteredCyclesForReport, 8), [filteredCyclesForReport]);

  const reportSummary = useMemo(() => {
    return {
      cyclesLogged: filteredCyclesForReport.length,
      averageCycleLength: getAverageCycleLength(filteredCyclesForReport),
      averagePeriodLength: getAveragePeriodLength(filteredCyclesForReport),
      topSymptoms: reportTopSymptoms.map((symptom) => `${symptom.name} (${symptom.count})`),
    };
  }, [filteredCyclesForReport, reportTopSymptoms]);

  const todayDateText = getTodayDateText();
  const todayHasLog = useMemo(() => dailyLogs.some((log) => log.logDate === todayDateText), [dailyLogs, todayDateText]);

  const cycleDiscMetrics = useMemo(() => {
    if (!cycles.length || !nextPredictedPeriodText) {
      return {
        cycleDay: 0,
        cycleLength: preferences.cycleLength,
        daysUntilNext: null as number | null,
        phaseLabel: "Start by adding a cycle",
        progress: 0.04,
        hasHistory: false,
        nextDateLabel: "No prediction yet",
      };
    }

    const today = todayDateText;
    const todayObject = toLocalDate(today);
    let nextStartObject = toLocalDate(nextPredictedPeriodText);

    while (nextStartObject.getTime() < todayObject.getTime()) {
      nextStartObject = addDays(nextStartObject, preferences.cycleLength);
    }

    const nextStartText = formatDateInput(nextStartObject);
    const currentCycleStartText = addDaysToDateText(nextStartText, -preferences.cycleLength);
    const cycleDay = clamp(daysBetween(currentCycleStartText, today) + 1, 1, preferences.cycleLength);
    const daysUntilNext = Math.max(0, daysBetween(today, nextStartText));

    let phaseLabel = "Luteal phase";
    if (loggedPeriodDays.has(today) || predictedPeriodDays.has(today) || cycleDay <= preferences.periodLength) {
      phaseLabel = "Period phase";
    } else if (ovulationDayText === today) {
      phaseLabel = "Ovulation day";
    } else if (fertileWindowDays.has(today)) {
      phaseLabel = "Fertile window";
    } else if (cycleDay <= Math.round(preferences.cycleLength * 0.45)) {
      phaseLabel = "Follicular phase";
    }

    return {
      cycleDay,
      cycleLength: preferences.cycleLength,
      daysUntilNext,
      phaseLabel,
      progress: cycleDay / preferences.cycleLength,
      hasHistory: true,
      nextDateLabel: formatDate(nextStartText),
    };
  }, [
    cycles.length,
    fertileWindowDays,
    loggedPeriodDays,
    nextPredictedPeriodText,
    ovulationDayText,
    predictedPeriodDays,
    preferences.cycleLength,
    preferences.periodLength,
    todayDateText,
  ]);

  const cycleDiscProgress = clamp(cycleDiscMetrics.progress, 0.04, 0.995);
  const discRadius = 90;
  const discCenter = 110;
  const discCircumference = 2 * Math.PI * discRadius;
  const discDashOffset = discCircumference * (1 - cycleDiscProgress);
  const discAngle = cycleDiscProgress * 2 * Math.PI - Math.PI / 2;
  const discDotX = discCenter + discRadius * Math.cos(discAngle);
  const discDotY = discCenter + discRadius * Math.sin(discAngle);
  const phaseIcon = getPhaseIcon(cycleDiscMetrics.phaseLabel);
  const phaseMascot = getMascot(cycleDiscMetrics.phaseLabel);
  const greetingText = useMemo(() => getGreeting(), []);
  const todayAffirmation = useMemo(() => getAffirmationForToday(), []);
  const todayStreak = useMemo(() => getDailyLogStreak(dailyLogs, todayDateText), [dailyLogs, todayDateText]);
  const unlockedStreakBadges = useMemo(
    () => milestoneTargets.filter((target) => todayStreak >= target),
    [todayStreak],
  );
  const cycleMilestones = useMemo(
    () => milestoneTargets.filter((target) => sortedCycles.length >= target),
    [sortedCycles.length],
  );

  const themeStyle = useMemo(() => {
    const preset = themePresets[selectedTheme];

    return {
      background: preset.background,
      "--background": preset.vars["--background"],
      "--foreground": preset.vars["--foreground"],
      "--surface": preset.vars["--surface"],
      "--surface-soft": preset.vars["--surface-soft"],
      "--surface-strong": preset.vars["--surface-strong"],
      "--primary": preset.vars["--primary"],
      "--primary-soft": preset.vars["--primary-soft"],
      "--accent": preset.vars["--accent"],
      "--ring": preset.vars["--ring"],
      "--border": preset.vars["--border"],
      "--shadow": preset.vars["--shadow"],
    } as CSSProperties;
  }, [selectedTheme]);

  const playSoftPing = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") {
      return;
    }

    try {
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 740;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
    } catch {
      // Ignore audio errors quietly.
    }
  }, [soundEnabled]);

  const triggerConfetti = useCallback(() => {
    const pieces: ConfettiPiece[] = Array.from({ length: 24 }).map((_, index) => ({
      id: `${Date.now()}-${index}`,
      emoji: confettiEmojis[index % confettiEmojis.length],
      left: Math.round((index / 24) * 100),
      duration: 1600 + Math.random() * 1400,
      delay: Math.random() * 280,
    }));

    setConfettiPieces(pieces);
    window.setTimeout(() => {
      setConfettiPieces([]);
    }, 2600);
  }, []);

  useEffect(() => {
    if (selectedDailyLog) {
      setDailyLogForm({
        mood: selectedDailyLog.mood,
        painLevel: selectedDailyLog.painLevel === null ? "" : `${selectedDailyLog.painLevel}`,
        energyLevel: selectedDailyLog.energyLevel === null ? "" : `${selectedDailyLog.energyLevel}`,
        discharge: selectedDailyLog.discharge,
        medications: selectedDailyLog.medications,
        notes: selectedDailyLog.notes,
      });
      return;
    }

    setDailyLogForm(getEmptyDailyLogForm());
  }, [selectedDailyLog]);

  const symptomInsights = useMemo(() => getTopSymptoms(cycles, 6), [cycles]);

  const flowInsights = useMemo(
    () => flowLevels.map((flow) => ({ flow, count: cycles.filter((cycle) => cycle.flow === flow).length })),
    [cycles],
  );

  const maxFlowCount = useMemo(() => Math.max(1, ...flowInsights.map((entry) => entry.count)), [flowInsights]);

  const averagePain = useMemo(() => {
    const values = dailyLogs.map((log) => log.painLevel).filter((value): value is number => value !== null);
    if (!values.length) {
      return null;
    }
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  }, [dailyLogs]);

  const averageEnergy = useMemo(() => {
    const values = dailyLogs.map((log) => log.energyLevel).filter((value): value is number => value !== null);
    if (!values.length) {
      return null;
    }
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  }, [dailyLogs]);

  const upcomingReminders = useMemo(() => {
    const reminders: string[] = [];

    reminders.push(`Daily log reminder at ${String(preferences.dailyLogReminderHour).padStart(2, "0")}:00`);

    if (nextPredictedPeriodText) {
      reminders.push(
        `Period alert on ${formatDate(
          addDaysToDateText(nextPredictedPeriodText, -preferences.periodReminderDaysBefore),
        )} (${preferences.periodReminderDaysBefore} days before predicted start)`,
      );
    } else {
      reminders.push("Add at least one cycle to unlock period reminders.");
    }

    if (!todayHasLog) {
      reminders.push("You have not logged today's daily update yet.");
    }

    return reminders;
  }, [nextPredictedPeriodText, preferences.dailyLogReminderHour, preferences.periodReminderDaysBefore, todayHasLog]);

  const maybeSendBrowserReminder = useCallback(() => {
    if (!preferences.notificationsEnabled || notificationPermission !== "granted") {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const now = new Date();
    if (now.getMinutes() > 4) {
      return;
    }

    const today = formatDateInput(now);

    if (now.getHours() === preferences.dailyLogReminderHour && !todayHasLog) {
      const key = `daily-${today}`;
      if (!reminderHistoryRef.current.has(key)) {
        new Notification("Peridot reminder", {
          body: "Log today's mood and symptoms.",
          icon: "/icon.svg",
        });
        reminderHistoryRef.current.add(key);
      }
    }

    if (nextPredictedPeriodText) {
      const daysUntilPeriod = daysBetween(today, nextPredictedPeriodText);

      if (daysUntilPeriod === preferences.periodReminderDaysBefore) {
        const key = `period-soon-${today}`;
        if (!reminderHistoryRef.current.has(key)) {
          new Notification("Peridot reminder", {
            body: `Your predicted period is in ${preferences.periodReminderDaysBefore} day(s).`,
            icon: "/icon.svg",
          });
          reminderHistoryRef.current.add(key);
        }
      }

      if (daysUntilPeriod === 0) {
        const key = `period-today-${today}`;
        if (!reminderHistoryRef.current.has(key)) {
          new Notification("Peridot reminder", {
            body: "Your predicted period starts today.",
            icon: "/icon.svg",
          });
          reminderHistoryRef.current.add(key);
        }
      }
    }
  }, [
    nextPredictedPeriodText,
    notificationPermission,
    preferences.dailyLogReminderHour,
    preferences.notificationsEnabled,
    preferences.periodReminderDaysBefore,
    todayHasLog,
  ]);

  useEffect(() => {
    if (notificationPermission !== "granted" || !preferences.notificationsEnabled) {
      return;
    }

    maybeSendBrowserReminder();
    const timer = window.setInterval(maybeSendBrowserReminder, 60000);
    return () => {
      window.clearInterval(timer);
    };
  }, [maybeSendBrowserReminder, notificationPermission, preferences.notificationsEnabled]);

  const handleCycleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleDailyLogChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setDailyLogForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handlePreferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;

    setPreferences((current) => {
      if (name === "notificationsEnabled" && type === "checkbox") {
        return {
          ...current,
          notificationsEnabled: checked,
        };
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return current;
      }

      if (name === "cycleLength") {
        return {
          ...current,
          cycleLength: clamp(Math.round(parsed), 21, 40),
        };
      }

      if (name === "periodLength") {
        const periodLength = clamp(Math.round(parsed), 1, 14);
        setFormData((formCurrent) => ({
          ...formCurrent,
          periodLength: `${periodLength}`,
        }));
        return {
          ...current,
          periodLength,
        };
      }

      if (name === "periodReminderDaysBefore") {
        return {
          ...current,
          periodReminderDaysBefore: clamp(Math.round(parsed), 1, 10),
        };
      }

      if (name === "dailyLogReminderHour") {
        return {
          ...current,
          dailyLogReminderHour: clamp(Math.round(parsed), 0, 23),
        };
      }

      return current;
    });
  };

  const saveCycle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !userId) {
      return;
    }

    setFeedbackMessage("");

    const parsedPeriodLength = Number(formData.periodLength);
    if (!formData.startDate || !Number.isFinite(parsedPeriodLength) || parsedPeriodLength < 1) {
      setFeedbackMessage("Please choose a valid start date and period length.");
      return;
    }

    const periodLength = clamp(Math.round(parsedPeriodLength), 1, 14);
    const endDate = addDaysToDateText(formData.startDate, periodLength - 1);

    const { data, error } = await supabase
      .from("cycles")
      .insert({
        user_id: userId,
        start_date: formData.startDate,
        end_date: endDate,
        period_length: periodLength,
        flow: formData.flow,
        symptoms: normalizeSymptoms(formData.symptoms),
        notes: formData.notes.trim(),
      })
      .select("id, start_date, end_date, period_length, flow, symptoms, notes, created_at")
      .single();

    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    setCycles((current) => [mapCycleRow(data as CycleRow), ...current]);
    setFormData((current) => ({
      ...current,
      symptoms: "",
      notes: "",
    }));
    setFeedbackMessage("Cycle saved.");
    triggerConfetti();
    playSoftPing();
  };

  const removeCycle = async (cycleId: string) => {
    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase.from("cycles").delete().eq("id", cycleId).eq("user_id", userId);
    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    setCycles((current) => current.filter((cycle) => cycle.id !== cycleId));
    setFeedbackMessage("Cycle removed.");
  };

  const saveDailyLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !userId) {
      return;
    }

    setFeedbackMessage("");

    if (isDailyLogFormEmpty(dailyLogForm)) {
      if (!selectedDailyLog) {
        setFeedbackMessage("Daily log is empty.");
        return;
      }

      const { error } = await supabase.from("daily_logs").delete().eq("id", selectedDailyLog.id).eq("user_id", userId);
      if (error) {
        setFeedbackMessage(error.message);
        return;
      }

      setDailyLogs((current) => current.filter((log) => log.id !== selectedDailyLog.id));
      setFeedbackMessage("Daily log removed.");
      playSoftPing();
      return;
    }

    const { data, error } = await supabase
      .from("daily_logs")
      .upsert(
        {
          user_id: userId,
          log_date: selectedDateText,
          mood: dailyLogForm.mood.trim(),
          pain_level: toNullableNumber(dailyLogForm.painLevel, 0, 10),
          energy_level: toNullableNumber(dailyLogForm.energyLevel, 0, 10),
          discharge: dailyLogForm.discharge.trim(),
          medications: dailyLogForm.medications.trim(),
          notes: dailyLogForm.notes.trim(),
        },
        {
          onConflict: "user_id,log_date",
        },
      )
      .select("id, log_date, mood, pain_level, energy_level, discharge, medications, notes, created_at, updated_at")
      .single();

    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    const mapped = mapDailyLogRow(data as DailyLogRow);
    setDailyLogs((current) => {
      const filtered = current.filter((log) => log.logDate !== mapped.logDate);
      return [mapped, ...filtered];
    });
    setFeedbackMessage("Daily log saved.");
    triggerConfetti();
    playSoftPing();
  };

  const clearDailyLog = async () => {
    if (!selectedDailyLog) {
      setDailyLogForm(getEmptyDailyLogForm());
      return;
    }

    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase.from("daily_logs").delete().eq("id", selectedDailyLog.id).eq("user_id", userId);
    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    setDailyLogs((current) => current.filter((log) => log.id !== selectedDailyLog.id));
    setDailyLogForm(getEmptyDailyLogForm());
    setFeedbackMessage("Daily log removed.");
    playSoftPing();
  };

  const requestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setPreferences((current) => ({
        ...current,
        notificationsEnabled: true,
      }));
      setFeedbackMessage("Browser reminders enabled.");
    }
  };

  const exportPdf = () => {
    if (!filteredCyclesForReport.length && !filteredDailyLogsForReport.length) {
      setFeedbackMessage("No data in the selected date range.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let cursorY = 56;

    const ensureRoom = (height: number) => {
      if (cursorY + height > pageHeight - 48) {
        doc.addPage();
        cursorY = 56;
      }
    };

    const rangeLabel = `${pdfRangeStart ? formatDate(pdfRangeStart) : "All"} - ${pdfRangeEnd ? formatDate(pdfRangeEnd) : "All"}`;
    const summaryLines = [
      `Account: ${userEmail || "-"}`,
      `Range: ${rangeLabel}`,
      `Cycles logged: ${reportSummary.cyclesLogged}`,
      `Average cycle length: ${reportSummary.averageCycleLength ?? "-"} days`,
      `Average period length: ${reportSummary.averagePeriodLength ?? "-"} days`,
      `Predicted next period: ${formatDateFromObject(nextPredictedPeriod)}`,
      `Top symptoms: ${reportSummary.topSymptoms.length ? reportSummary.topSymptoms.join(", ") : "-"}`,
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Peridot Doctor Summary", 40, cursorY);
    cursorY += 28;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 40, cursorY);
    cursorY += 18;

    doc.setDrawColor(243, 163, 207);
    doc.line(40, cursorY, pageWidth - 40, cursorY);
    cursorY += 22;

    doc.setFontSize(12);
    summaryLines.forEach((line) => {
      ensureRoom(18);
      doc.text(line, 40, cursorY);
      cursorY += 18;
    });

    const notableCycleNotes = filteredCyclesForReport
      .map((cycle) => cycle.notes)
      .filter((note) => note.trim())
      .slice(0, 8);

    if (notableCycleNotes.length) {
      ensureRoom(24);
      cursorY += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Doctor notes from cycles:", 40, cursorY);
      cursorY += 16;
      doc.setFont("helvetica", "normal");

      notableCycleNotes.forEach((note) => {
        const wrapped = doc.splitTextToSize(`- ${note}`, pageWidth - 90);
        ensureRoom(wrapped.length * 14 + 4);
        doc.text(wrapped, 48, cursorY);
        cursorY += wrapped.length * 14;
      });
    }

    doc.addPage();
    cursorY = 56;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Cycle details", 40, cursorY);
    cursorY += 24;

    filteredCyclesForReport.forEach((cycle, index) => {
      ensureRoom(96);

      doc.setFillColor(255, 241, 249);
      doc.roundedRect(40, cursorY - 14, pageWidth - 80, 22, 6, 6, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        `Cycle ${filteredCyclesForReport.length - index}: ${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}`,
        48,
        cursorY,
      );
      cursorY += 20;

      doc.setFont("helvetica", "normal");
      doc.text(`Flow: ${cycle.flow} | Period length: ${cycle.periodLength} days`, 48, cursorY);
      cursorY += 16;

      if (cycle.symptoms.length) {
        const symptomLines = doc.splitTextToSize(`Symptoms: ${cycle.symptoms.join(", ")}`, pageWidth - 100);
        ensureRoom(symptomLines.length * 14 + 4);
        doc.text(symptomLines, 48, cursorY);
        cursorY += symptomLines.length * 14;
      }

      if (cycle.notes) {
        const noteLines = doc.splitTextToSize(`Notes: ${cycle.notes}`, pageWidth - 100);
        ensureRoom(noteLines.length * 14 + 4);
        doc.text(noteLines, 48, cursorY);
        cursorY += noteLines.length * 14;
      }

      cursorY += 14;
    });

    if (filteredDailyLogsForReport.length) {
      doc.addPage();
      cursorY = 56;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Daily logs", 40, cursorY);
      cursorY += 24;

      filteredDailyLogsForReport.forEach((log) => {
        ensureRoom(90);

        doc.setFillColor(255, 245, 251);
        doc.roundedRect(40, cursorY - 14, pageWidth - 80, 20, 6, 6, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(formatDate(log.logDate), 48, cursorY);
        cursorY += 18;

        doc.setFont("helvetica", "normal");
        const firstLine = `Mood: ${log.mood || "-"} | Pain: ${log.painLevel ?? "-"} | Energy: ${log.energyLevel ?? "-"}`;
        doc.text(firstLine, 48, cursorY);
        cursorY += 14;

        if (log.discharge) {
          doc.text(`Discharge: ${log.discharge}`, 48, cursorY);
          cursorY += 14;
        }

        if (log.medications) {
          const meds = doc.splitTextToSize(`Meds: ${log.medications}`, pageWidth - 100);
          ensureRoom(meds.length * 14 + 2);
          doc.text(meds, 48, cursorY);
          cursorY += meds.length * 14;
        }

        if (log.notes) {
          const noteLines = doc.splitTextToSize(`Notes: ${log.notes}`, pageWidth - 100);
          ensureRoom(noteLines.length * 14 + 2);
          doc.text(noteLines, 48, cursorY);
          cursorY += noteLines.length * 14;
        }

        cursorY += 12;
      });
    }

    doc.save(`peridot-doctor-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    setFeedbackMessage("PDF exported.");
  };

  const createShareLink = async () => {
    if (!supabase || !userId) {
      return;
    }

    if (!filteredCyclesForReport.length && !filteredDailyLogsForReport.length) {
      setFeedbackMessage("No range data to share.");
      return;
    }

    const token = `${crypto.randomUUID().replace(/-/g, "")}${Math.random().toString(36).slice(2, 10)}`;
    const expiryDays = Number(shareExpiryDays);
    const expiresAt =
      Number.isFinite(expiryDays) && expiryDays > 0
        ? new Date(Date.now() + expiryDays * ONE_DAY_MS).toISOString()
        : null;

    const reportPayload = {
      generatedAt: new Date().toISOString(),
      rangeStart: pdfRangeStart || null,
      rangeEnd: pdfRangeEnd || null,
      summary: reportSummary,
      cycles: filteredCyclesForReport,
      dailyLogs: filteredDailyLogsForReport,
    };

    const { data, error } = await supabase
      .from("shared_reports")
      .insert({
        user_id: userId,
        token,
        title: shareTitle.trim() || "Doctor read-only report",
        range_start: pdfRangeStart || null,
        range_end: pdfRangeEnd || null,
        report_payload: reportPayload,
        expires_at: expiresAt,
      })
      .select("id, token, title, range_start, range_end, expires_at, revoked, created_at")
      .single();

    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    const mapped = mapShareRow(data as ShareRow);
    setShareLinks((current) => [mapped, ...current]);
    if (typeof window !== "undefined") {
      setLatestShareUrl(`${window.location.origin}/share/${mapped.token}`);
    }
    setFeedbackMessage("Read-only share link created.");
    triggerConfetti();
    playSoftPing();
  };

  const revokeShareLink = async (shareId: string) => {
    if (!supabase || !userId) {
      return;
    }

    const { error } = await supabase
      .from("shared_reports")
      .update({
        revoked: true,
      })
      .eq("id", shareId)
      .eq("user_id", userId);

    if (error) {
      setFeedbackMessage(error.message);
      return;
    }

    setShareLinks((current) =>
      current.map((link) =>
        link.id === shareId
          ? {
              ...link,
              revoked: true,
            }
          : link,
      ),
    );
    setFeedbackMessage("Share link revoked.");
  };

  const copyShareUrl = async (token: string) => {
    if (typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
    setFeedbackMessage("Share link copied.");
  };

  const copyLatestShareUrl = async () => {
    if (!latestShareUrl || typeof window === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(latestShareUrl);
    setFeedbackMessage("Latest share link copied.");
  };

  const changeCalendarMonth = (offset: number) => {
    setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateText(getTodayDateText());
  };

  const handleBottomNav = (tab: BottomTab) => {
    setActiveBottomTab(tab);

    if (tab === "journal") {
      setMode("journal");
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    if (tab === "calendar") {
      setMode("calendar");
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    setMode("journal");
    const sectionId = tab === "insights" ? "insights-section" : "share-section";
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const logOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-5 py-10">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
          <p className="text-3xl">🌸</p>
          <h1 className="text-3xl text-[var(--foreground)]">Supabase setup needed</h1>
          <p className="mt-3 text-sm text-[var(--foreground)]">
            Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in
            `.env.local`.
          </p>
          <p className="mt-2 text-sm text-[var(--foreground)]">
            Then run the SQL in `supabase/schema.sql` and refresh this page.
          </p>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--foreground)] shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
          <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2">
            <span className="animate-pulse text-2xl">🌸</span>
            <span className="animate-pulse text-2xl [animation-delay:140ms]">✨</span>
            <span className="animate-pulse text-2xl [animation-delay:280ms]">🌙</span>
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-[var(--accent)]">Loading your cycle dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <main
      style={themeStyle}
      className={`relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 pb-28 sm:px-6 lg:gap-8 lg:py-10 ${
        doctorMode ? "doctor-mode bg-white" : ""
      }`}
    >
      {confettiPieces.length ? (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece text-xl"
              style={{
                left: `${piece.left}%`,
                animationDuration: `${piece.duration}ms`,
                animationDelay: `${piece.delay}ms`,
              }}
            >
              {piece.emoji}
            </span>
          ))}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)] backdrop-blur-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              Peridot tracker
            </p>
            <h1 className="text-3xl leading-tight text-[var(--foreground)] sm:text-4xl">{greetingText}</h1>
            <p className="text-xs font-semibold text-[color-mix(in_oklab,var(--foreground)_68%,white)]">
              {userEmail || "Signed in"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("journal");
                  setActiveBottomTab("journal");
                }}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  mode === "journal"
                    ? "bg-white text-[var(--foreground)] shadow-[0_10px_20px_-16px_rgba(var(--shadow),0.9)]"
                    : "text-[color-mix(in_oklab,var(--foreground)_70%,white)]"
                }`}
              >
                Journal
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("calendar");
                  setActiveBottomTab("calendar");
                }}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  mode === "calendar"
                    ? "bg-white text-[var(--foreground)] shadow-[0_10px_20px_-16px_rgba(var(--shadow),0.9)]"
                    : "text-[color-mix(in_oklab,var(--foreground)_70%,white)]"
                }`}
              >
                Calendar
              </button>
            </div>

            <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
              {(Object.keys(themePresets) as ThemeId[]).map((themeId) => (
                <button
                  key={themeId}
                  type="button"
                  onClick={() => setSelectedTheme(themeId)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                    selectedTheme === themeId
                      ? "bg-white text-[var(--foreground)] shadow-[0_10px_20px_-16px_rgba(var(--shadow),0.9)]"
                      : "text-[color-mix(in_oklab,var(--foreground)_66%,white)]"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {themeEmojiMap[themeId]}
                  </span>
                  <span className="sr-only">{themePresets[themeId].label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 text-sm font-bold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            >
              Export PDF
            </button>

            <button
              type="button"
              onClick={() => setDoctorMode((current) => !current)}
              className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-bold transition ${
                doctorMode
                  ? "border-[var(--primary)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-white text-[var(--accent)] hover:bg-[var(--surface-strong)]"
              }`}
            >
              {doctorMode ? "Doctor mode on" : "Doctor mode"}
            </button>

            <button
              type="button"
              onClick={logOut}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
            >
              Log out
            </button>
          </div>
        </div>
      </section>

      {feedbackMessage ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
          {feedbackMessage}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-[0_22px_42px_-30px_rgba(var(--shadow),0.88)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Today card</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">💌 {todayAffirmation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {phaseIcon} {cycleDiscMetrics.phaseLabel}
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {phaseMascot.emoji} {phaseMascot.name}
            </span>
          </div>
        </article>

        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 shadow-[0_22px_42px_-30px_rgba(var(--shadow),0.88)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Streaks & milestones</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">🔥 {todayStreak} day daily-log streak</p>
          <p className="mt-1 text-xs font-semibold text-[color-mix(in_oklab,var(--foreground)_66%,white)]">
            {unlockedStreakBadges.length} streak badges unlocked
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {milestoneTargets.map((target) => {
              const unlocked = todayStreak >= target;
              return (
                <span
                  key={`streak-${target}`}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    unlocked
                      ? "border-[var(--primary)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)] text-[color-mix(in_oklab,var(--foreground)_66%,white)]"
                  }`}
                >
                  {unlocked ? "💖" : "🤍"} {target}d
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cycleMilestones.length ? (
              cycleMilestones.map((milestone) => (
                <span
                  key={`cycle-milestone-${milestone}`}
                  className="rounded-full border border-[var(--primary)] bg-[var(--surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]"
                >
                  🎉 You logged {milestone} cycles
                </span>
              ))
            ) : (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color-mix(in_oklab,var(--foreground)_66%,white)]">
                First milestone at 3 cycles
              </span>
            )}
          </div>
        </article>
      </section>

      {mode === "journal" ? (
        <>
          <section className="grid gap-4 lg:items-start lg:grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
            <article className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_22px_42px_-30px_rgba(var(--shadow),0.88)]">
              <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[radial-gradient(circle,#ffd8ef_0%,#ffd8ef00_70%)]" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,#ffb9df_0%,#ffb9df00_70%)]" />

              <p className="relative text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                Cycle progress
              </p>

              <div className="relative mx-auto mt-2 flex h-[235px] w-[235px] items-center justify-center">
                <svg viewBox="0 0 220 220" className="-rotate-90 h-[220px] w-[220px] drop-shadow-[0_8px_14px_rgba(219,74,149,0.22)]">
                  <defs>
                    <linearGradient id="cycleDiscStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4db0" />
                      <stop offset="62%" stopColor="#ff78c4" />
                      <stop offset="100%" stopColor="#ffbf6e" />
                    </linearGradient>
                  </defs>
                  <circle cx={discCenter} cy={discCenter} r={discRadius} stroke="#ffe8f5" strokeWidth={18} fill="none" />
                  <circle
                    cx={discCenter}
                    cy={discCenter}
                    r={discRadius}
                    stroke="url(#cycleDiscStroke)"
                    strokeWidth={18}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={discCircumference}
                    strokeDashoffset={discDashOffset}
                    className="transition-all duration-700 ease-out"
                  />
                  <circle
                    cx={discCenter}
                    cy={discCenter}
                    r={discRadius}
                    stroke="#ffffff80"
                    strokeWidth={6}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="38 40"
                    className="cycle-ring-shimmer"
                  />
                  <circle cx={discDotX} cy={discDotY} r={6} fill="#ff4db0" stroke="#fff5fb" strokeWidth={3} />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    {phaseIcon} Cycle day
                  </p>
                  <p className="mt-1 text-5xl leading-none text-[var(--foreground)]">
                    {cycleDiscMetrics.hasHistory ? cycleDiscMetrics.cycleDay : "--"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                    {cycleDiscMetrics.hasHistory
                      ? `${cycleDiscMetrics.daysUntilNext} day${cycleDiscMetrics.daysUntilNext === 1 ? "" : "s"} until next period`
                      : "Add your first cycle"}
                  </p>
                </div>
              </div>

              <div className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {cycleDiscMetrics.phaseLabel}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  Next: {cycleDiscMetrics.nextDateLabel}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--accent)]">
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">🩸</span>
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">🌸</span>
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">🌙</span>
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">✨</span>
              </div>
            </article>

            <div className="flex flex-col gap-3 self-start">
              <article className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_16px_30px_-28px_rgba(var(--shadow),0.9)]">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    Predicted next
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">
                    {formatDateFromObject(nextPredictedPeriod)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                  {cycleDiscMetrics.daysUntilNext !== null
                    ? `🗓️ ${cycleDiscMetrics.daysUntilNext}d`
                    : "No data"}
                </span>
              </article>

              <article className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_16px_30px_-28px_rgba(var(--shadow),0.9)]">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    Current phase
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">
                    {phaseIcon} {cycleDiscMetrics.phaseLabel}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                  {phaseMascot.emoji} {phaseMascot.name}
                </span>
              </article>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
            <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
              <h2 className="text-2xl text-[var(--foreground)]">Add cycle</h2>

              <form className="mt-3 space-y-4" onSubmit={saveCycle}>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Start date</span>
                  <input
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleCycleFormChange}
                    required
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Period length (days)</span>
                  <input
                    name="periodLength"
                    type="number"
                    min={1}
                    max={14}
                    value={formData.periodLength}
                    onChange={handleCycleFormChange}
                    required
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                  Estimated end date: {estimatedEndDate ? formatDate(estimatedEndDate) : "Add a valid period length"}
                </p>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Flow</span>
                  <select
                    name="flow"
                    value={formData.flow}
                    onChange={handleCycleFormChange}
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {flowLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Symptoms (comma separated)</span>
                  <input
                    name="symptoms"
                    type="text"
                    value={formData.symptoms}
                    onChange={handleCycleFormChange}
                    placeholder="Cramps, headache, fatigue"
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Cycle notes</span>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleCycleFormChange}
                    rows={4}
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--primary-soft)]"
                >
                  Save cycle
                </button>
              </form>
            </article>

            <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl text-[var(--foreground)]">Cycle history</h2>
                <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {sortedCycles.length} logged
                </p>
              </div>

              {sortedCycles.length ? (
                <ul className="mt-4 space-y-3">
                  {sortedCycles.map((cycle) => (
                    <li
                      key={cycle.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg leading-tight text-[var(--foreground)]">
                          {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removeCycle(cycle.id)}
                          className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
                        >
                          Delete
                        </button>
                      </div>

                      <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--foreground)_75%,white)]">
                        Flow: <strong className="text-[var(--foreground)]">{cycle.flow}</strong> | Period length:{" "}
                        <strong className="text-[var(--foreground)]">{cycle.periodLength} days</strong>
                      </p>

                      {cycle.symptoms.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {cycle.symptoms.map((symptom) => (
                            <span
                              key={`${cycle.id}-${symptom}`}
                              className="rounded-[999px] border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] shadow-[0_8px_16px_-14px_rgba(var(--shadow),0.85)]"
                            >
                              💗 {symptom}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {cycle.notes ? (
                        <div className="mt-3 max-w-[24rem] rotate-[-1.2deg] rounded-md border border-[#f3cde2] bg-[#fffdf8] px-3 py-2 shadow-[0_14px_24px_-20px_rgba(var(--shadow),0.85)]">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Polaroid note</p>
                          <p className="mt-1 text-sm leading-relaxed text-[var(--foreground)]">{cycle.notes}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-6 text-sm text-[color-mix(in_oklab,var(--foreground)_74%,white)]">
                  No cycles logged yet.
                </p>
              )}
            </article>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl text-[var(--foreground)]">Custom settings & reminders</h2>
              <p className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Logged avg: {loggedAverageCycleLength ?? "-"}d cycle / {loggedAveragePeriodLength ?? "-"}d period
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Cycle length</span>
                <input
                  name="cycleLength"
                  type="number"
                  min={21}
                  max={40}
                  value={preferences.cycleLength}
                  onChange={handlePreferenceChange}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Period length</span>
                <input
                  name="periodLength"
                  type="number"
                  min={1}
                  max={14}
                  value={preferences.periodLength}
                  onChange={handlePreferenceChange}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Period reminder (days before)</span>
                <input
                  name="periodReminderDaysBefore"
                  type="number"
                  min={1}
                  max={10}
                  value={preferences.periodReminderDaysBefore}
                  onChange={handlePreferenceChange}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Daily reminder hour</span>
                <input
                  name="dailyLogReminderHour"
                  type="number"
                  min={0}
                  max={23}
                  value={preferences.dailyLogReminderHour}
                  onChange={handlePreferenceChange}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)]">
                <input
                  name="notificationsEnabled"
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={handlePreferenceChange}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                Browser reminders
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(event) => setSoundEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                Micro-sounds
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={requestBrowserNotifications}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
              >
                Allow browser notifications
              </button>
              <p className="text-xs font-semibold text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                Permission: {notificationPermission}
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {upcomingReminders.map((reminder) => (
                <li
                  key={reminder}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  {reminder}
                </li>
              ))}
            </ul>
          </section>

          <section id="insights-section" className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
              <h2 className="text-2xl text-[var(--foreground)]">Insights</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Avg pain</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{averagePain ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Avg energy</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{averageEnergy ?? "-"}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">Flow distribution</p>
                {flowInsights.map((entry) => (
                  <div key={entry.flow} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent)]">
                      <span>{entry.flow}</span>
                      <span>{entry.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-soft)]">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{
                          width: `${(entry.count / maxFlowCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
              <h2 className="text-2xl text-[var(--foreground)]">Symptom trends</h2>
              {symptomInsights.length ? (
                <ul className="mt-4 space-y-2">
                  {symptomInsights.map((symptom) => (
                    <li
                      key={symptom.name}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-[var(--foreground)]">{symptom.name}</span>
                      <span className="text-xs font-semibold text-[var(--accent)]">{symptom.count} times</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                  Add more cycle entries to generate symptom trends.
                </p>
              )}
            </article>
          </section>

          <section id="share-section" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl text-[var(--foreground)]">Reports & sharing</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
              >
                Print doctor mode
              </button>
            </div>

            {doctorMode ? (
              <div className="doctor-print-header mt-4 rounded-2xl border border-[var(--border)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--accent)]">🩺 Peridot doctor mode</p>
                <p className="mt-1 text-xs text-[var(--foreground)]">
                  Clean printable summary with key cycle metrics and logs.
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Range start</span>
                <input
                  type="date"
                  value={pdfRangeStart}
                  onChange={(event) => setPdfRangeStart(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Range end</span>
                <input
                  type="date"
                  value={pdfRangeEnd}
                  onChange={(event) => setPdfRangeEnd(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Share title</span>
                <input
                  type="text"
                  value={shareTitle}
                  onChange={(event) => setShareTitle(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">Share expires in (days)</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={shareExpiryDays}
                  onChange={(event) => setShareExpiryDays(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportPdf}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-soft)]"
              >
                Export doctor PDF
              </button>
              <button
                type="button"
                onClick={createShareLink}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
              >
                Create read-only link
              </button>
            </div>

            {latestShareUrl ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="break-all text-xs font-semibold text-[var(--foreground)]">{latestShareUrl}</p>
                <button
                  type="button"
                  onClick={copyLatestShareUrl}
                  className="mt-2 inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
                >
                  Copy latest link
                </button>
              </div>
            ) : null}

            {shareLinks.length ? (
              <ul className="mt-4 space-y-2">
                {shareLinks.map((link) => (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{link.title}</p>
                      <p className="text-xs text-[color-mix(in_oklab,var(--foreground)_70%,white)]">
                        {link.rangeStart ? formatDate(link.rangeStart) : "All"} - {link.rangeEnd ? formatDate(link.rangeEnd) : "All"} |
                        Created {new Date(link.createdAt).toLocaleDateString()}
                        {link.expiresAt ? ` | Expires ${new Date(link.expiresAt).toLocaleDateString()}` : ""}
                        {link.revoked ? " | Revoked" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyShareUrl(link.token)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
                      >
                        Copy
                      </button>
                      {!link.revoked ? (
                        <button
                          type="button"
                          onClick={() => revokeShareLink(link.id)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                No share links yet.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeCalendarMonth(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-lg font-bold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
              >
                ‹
              </button>
              <h2 className="text-2xl text-[var(--foreground)]">{getMonthLabel(calendarMonth)}</h2>
              <button
                type="button"
                onClick={() => changeCalendarMonth(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-lg font-bold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
              >
                ›
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-[0.06em] text-[color-mix(in_oklab,var(--foreground)_62%,white)]">
              {weekDayLabels.map((dayLabel) => (
                <p key={dayLabel}>{dayLabel}</p>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((day) => {
                const dateText = formatDateInput(day.date);
                const isTodayDay = dateText === todayDateText;
                const isSelectedDay = dateText === selectedDateText;
                const isLoggedDay = loggedPeriodDays.has(dateText);
                const isPredictedDay = predictedPeriodDays.has(dateText);
                const isOvulationDay = ovulationDayText === dateText;
                const isFertileDay = fertileWindowDays.has(dateText);
                const dayLog = dailyLogByDate.get(dateText);
                const dayIcons: string[] = [];

                if (isLoggedDay || isPredictedDay) {
                  dayIcons.push("🩸");
                }
                if (dayLog?.mood) {
                  dayIcons.push("😊");
                }
                if (dayLog?.medications) {
                  dayIcons.push("💊");
                }

                const toneClass = !day.inCurrentMonth
                  ? "border-transparent bg-transparent text-[color-mix(in_oklab,var(--foreground)_48%,white)]"
                  : isLoggedDay
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_14px_20px_-18px_rgba(var(--shadow),1)]"
                    : isPredictedDay
                      ? "border-[var(--primary-soft)] bg-[var(--surface-strong)] text-[var(--foreground)]"
                      : isOvulationDay
                        ? "border-[#b68be8] bg-[#ead9ff] text-[var(--foreground)]"
                        : isFertileDay
                          ? "border-[#8fd3ac] bg-[#e1f8ea] text-[var(--foreground)]"
                          : "border-transparent bg-[var(--surface-soft)] text-[var(--foreground)]";

                return (
                  <button
                    key={dateText}
                    type="button"
                    onClick={() => setSelectedDateText(dateText)}
                    className={`relative flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition hover:-translate-y-0.5 ${toneClass} ${
                      isTodayDay ? "ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--surface)]" : ""
                    } ${isSelectedDay ? "outline outline-2 outline-[var(--accent)]" : ""}`}
                  >
                    <span>{day.date.getDate()}</span>
                    {dayIcons.length ? (
                      <span className="pointer-events-none absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 text-[10px] leading-none">
                        {dayIcons.slice(0, 2).map((icon, index) => (
                          <span key={`${dateText}-${icon}-${index}`}>{icon}</span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[color-mix(in_oklab,var(--foreground)_70%,white)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                Logged period
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--surface-strong)]" />
                Predicted period
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d7beff]" />
                Ovulation
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#c8f1d8]" />
                Fertile window
              </span>
            </div>
          </article>

          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
            <h2 className="text-2xl text-[var(--foreground)]">Selected day</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{formatDate(selectedDateText)}</p>
            <p className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
              {selectedPhaseLabel}
              {selectedCycleDay ? ` | Cycle day ${selectedCycleDay}` : ""}
            </p>

            {selectedDateEntries.length ? (
              <ul className="mt-4 space-y-3">
                {selectedDateEntries.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatDate(entry.startDate)} - {formatDate(entry.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                      Flow {entry.flow} | Period length {entry.periodLength} days
                    </p>
                    {entry.notes ? <p className="mt-2 text-sm text-[var(--foreground)]">{entry.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                No cycle logged for this day.
              </p>
            )}

            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Prediction window</p>
              <p className="text-sm text-[var(--foreground)]">{predictedRangeLabel}</p>
            </div>

            <form className="mt-4 space-y-3" onSubmit={saveDailyLog}>
              <h3 className="text-lg text-[var(--foreground)]">Daily log</h3>

              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                  How are you feeling?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {moodStickerOptions.map((moodOption) => {
                    const active = dailyLogForm.mood === moodOption.value;
                    return (
                      <button
                        key={moodOption.value}
                        type="button"
                        onClick={() =>
                          setDailyLogForm((current) => ({
                            ...current,
                            mood: moodOption.value,
                          }))
                        }
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-[var(--primary)] bg-white text-[var(--foreground)] shadow-[0_12px_20px_-16px_rgba(var(--shadow),0.9)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[color-mix(in_oklab,var(--foreground)_72%,white)]"
                        }`}
                      >
                        <span className="mr-1">{moodOption.emoji}</span>
                        {moodOption.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    Pain (0-10)
                  </span>
                  <input
                    name="painLevel"
                    type="number"
                    min={0}
                    max={10}
                    value={dailyLogForm.painLevel}
                    onChange={handleDailyLogChange}
                    className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    Energy (0-10)
                  </span>
                  <input
                    name="energyLevel"
                    type="number"
                    min={0}
                    max={10}
                    value={dailyLogForm.energyLevel}
                    onChange={handleDailyLogChange}
                    className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Discharge</span>
                <input
                  name="discharge"
                  type="text"
                  value={dailyLogForm.discharge}
                  onChange={handleDailyLogChange}
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Medications</span>
                <input
                  name="medications"
                  type="text"
                  value={dailyLogForm.medications}
                  onChange={handleDailyLogChange}
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Notes</span>
                <textarea
                  name="notes"
                  value={dailyLogForm.notes}
                  onChange={handleDailyLogChange}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-soft)]"
                >
                  Save daily log
                </button>
                <button
                  type="button"
                  onClick={clearDailyLog}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
                >
                  Clear
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={jumpToToday}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-strong)]"
            >
              Jump to today
            </button>
          </article>
        </section>
      )}

      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-[0_24px_40px_-26px_rgba(var(--shadow),0.95)] backdrop-blur sm:inset-x-6 md:hidden">
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { id: "journal", label: "Journal", icon: "💗" },
            { id: "calendar", label: "Calendar", icon: "🗓️" },
            { id: "insights", label: "Insights", icon: "📈" },
            { id: "share", label: "Share", icon: "🩺" },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleBottomNav(item.id)}
              className={`rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
                activeBottomTab === item.id
                  ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-[0_10px_16px_-14px_rgba(var(--shadow),0.9)]"
                  : "text-[color-mix(in_oklab,var(--foreground)_70%,white)]"
              }`}
            >
              <span className="mr-1">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
