export type FollowUpPriority = "Low" | "Normal" | "High" | "Urgent";
export type FollowUpStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

export type FollowUpEntry = {
  id: string;
  contactIds: string[];
  description: string;
  amount: string;
  date: string;
  time: string;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  notes: string;
  nextAction: string;
  assignedAt: string;
};

export type FollowUpRecordLike = {
  id: string;
  title: string;
  module: string;
  location?: string;
  areaValue?: string;
  areaUnit?: string;
  value?: string;
  ratePerUnit?: string;
  contact?: string;
  primaryContactId?: string;
  createdAt?: string;
  nextFollowUpDate?: string;
  nextAction?: string;
  status?: string;
  notes?: string;
  moduleData?: Record<string, string>;
};

const PRIORITIES = new Set<FollowUpPriority>(["Low", "Normal", "High", "Urgent"]);
const STATUSES = new Set<FollowUpStatus>(["Open", "In Progress", "Completed", "Cancelled"]);

export function parseFollowUps(moduleData?: Record<string, string>): FollowUpEntry[] {
  const raw = moduleData?.__followUps;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FollowUpEntry =>
      Boolean(item && typeof item === "object" && typeof (item as FollowUpEntry).id === "string")
    ).map(item => ({
      id: item.id,
      contactIds: Array.isArray(item.contactIds) ? item.contactIds.filter((id): id is string => typeof id === "string") : [],
      description: String(item.description || ""),
      amount: String(item.amount || ""),
      date: String(item.date || ""),
      time: String(item.time || ""),
      priority: PRIORITIES.has(item.priority) ? item.priority : "Normal",
      status: STATUSES.has(item.status) ? item.status : "Open",
      notes: String(item.notes || ""),
      nextAction: String(item.nextAction || ""),
      assignedAt: String(item.assignedAt || "")
    }));
  } catch {
    return [];
  }
}

export function serializeFollowUps(entries: FollowUpEntry[]): string {
  return JSON.stringify(entries);
}

export function isFollowUpClosed(status: string): boolean {
  return status === "Completed" || status === "Cancelled";
}

export function legacyRecordFollowUp(record: FollowUpRecordLike): FollowUpEntry | null {
  if (!record.nextFollowUpDate) return null;
  const status = ["completed", "closed", "settled"].includes(String(record.status || "").toLowerCase())
    ? "Completed" as const
    : "Open" as const;
  const people = [
    ...(record.moduleData?.__followUpContactIds || "").split(","),
    record.primaryContactId || ""
  ].map(id => id.trim()).filter(Boolean);
  return {
    id: "legacy:" + record.id,
    contactIds: Array.from(new Set(people)),
    description: record.nextAction || "Follow-up · " + record.title,
    amount: record.value || "",
    date: record.nextFollowUpDate,
    time: "",
    priority: "Normal",
    status,
    notes: record.notes || "",
    nextAction: record.nextAction || "",
    assignedAt: record.createdAt || ""
  };
}
