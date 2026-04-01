import { vi } from "vitest";

// In-memory data store for tests
export interface MockUser {
  id: string;
  email: string;
  displayName: string | null;
  gender: "man" | "kvinna" | "ej_angett";
  birthDate: string | null;
  isAdmin: boolean;
  passwordHash: string;
  emailVerified: boolean;
  municipalityId: string | null;
}

export interface MockActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date | null;
  creatorId: string | null;
  maxParticipants: number | null;
  genderRestriction: "alla" | "kvinnor" | "man";
  minAge: number | null;
  whatToExpect: Record<string, unknown> | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  imageThumbUrl: string | null;
  imageMediumUrl: string | null;
  imageOgUrl: string | null;
  municipalityId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockParticipant {
  activityId: string;
  userId: string;
  status: "interested" | "attending";
  joinedAt: Date;
}

export interface MockComment {
  id: string;
  activityId: string;
  userId: string | null;
  content: string;
  createdAt: Date;
}

export interface MockFeedback {
  activityId: string;
  userId: string;
  rating: "positive" | "neutral" | "negative";
}

export interface MockNotification {
  id: string;
  userId: string;
  type: string;
  activityId: string | null;
  params: Record<string, unknown> | null;
  read: boolean;
}

export interface MockBlock {
  blockerId: string;
  blockedId: string;
}

export interface MockTag {
  id: number;
  name: string;
  slug: string;
}

export interface MockStore {
  users: MockUser[];
  activities: MockActivity[];
  participants: MockParticipant[];
  comments: MockComment[];
  feedback: MockFeedback[];
  notifications: MockNotification[];
  blocks: MockBlock[];
  tags: MockTag[];
  activityTags: Array<{ activityId: string; tagId: number }>;
  analyticsEvents: Array<Record<string, unknown>>;
}

export function createMockStore(): MockStore {
  return {
    users: [],
    activities: [],
    participants: [],
    comments: [],
    feedback: [],
    notifications: [],
    blocks: [],
    tags: [],
    activityTags: [],
    analyticsEvents: [],
  };
}

let store: MockStore;
let currentUserId: string | null = null;

export function resetStore() {
  store = createMockStore();
  currentUserId = null;
}

export function getStore() {
  return store;
}

export function setCurrentUser(userId: string | null) {
  currentUserId = userId;
}

export function getCurrentUserId() {
  return currentUserId;
}

// Seed helpers
export function addUser(overrides: Partial<MockUser> & { id: string; email: string }): MockUser {
  const user: MockUser = {
    displayName: null,
    gender: "ej_angett",
    birthDate: null,
    isAdmin: false,
    passwordHash: "hashed",
    emailVerified: true,
    municipalityId: "vasteras",
    ...overrides,
  };
  store.users.push(user);
  return user;
}

export function addActivity(overrides: Partial<MockActivity> & { id: string; title: string; creatorId: string }): MockActivity {
  const activity: MockActivity = {
    description: "Test description for the activity",
    location: "Västerås",
    startTime: new Date("2026-04-15T10:00:00Z"),
    endTime: null,
    maxParticipants: null,
    genderRestriction: "alla",
    minAge: null,
    whatToExpect: null,
    cancelledAt: null,
    cancelledReason: null,
    imageThumbUrl: null,
    imageMediumUrl: null,
    imageOgUrl: null,
    municipalityId: "vasteras",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.activities.push(activity);
  return activity;
}

export function addParticipant(activityId: string, userId: string, status: "interested" | "attending" = "attending"): MockParticipant {
  const p: MockParticipant = { activityId, userId, status, joinedAt: new Date() };
  store.participants.push(p);
  return p;
}

export function addComment(overrides: Partial<MockComment> & { id: string; activityId: string; userId: string }): MockComment {
  const c: MockComment = {
    content: "Test comment",
    createdAt: new Date(),
    ...overrides,
  };
  store.comments.push(c);
  return c;
}

export function addTag(id: number, name: string, slug?: string): MockTag {
  const tag: MockTag = { id, name, slug: slug ?? name.toLowerCase().replace(/\s+/g, "-") };
  store.tags.push(tag);
  return tag;
}

export function addActivityTag(activityId: string, tagId: number) {
  store.activityTags.push({ activityId, tagId });
}

// Create the chainable mock DB
function createChainableMock(resolveValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "innerJoin", "leftJoin", "groupBy", "orderBy", "limit", "returning", "set", "values", "onConflictDoUpdate", "onConflictDoNothing"];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Terminal: await resolves
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(resolveValue);
  return chain;
}

export function createMockDb() {
  return {
    query: {
      activities: {
        findFirst: vi.fn(({ where }: { where?: unknown } = {}) => {
          // Simple ID-based lookup
          return Promise.resolve(store.activities[0] ?? null);
        }),
      },
      activityParticipants: {
        findFirst: vi.fn(() => {
          const userId = currentUserId;
          const p = store.participants.find((p) => p.userId === userId);
          return Promise.resolve(p ?? null);
        }),
      },
      users: {
        findFirst: vi.fn(({ where }: { where?: unknown } = {}) => {
          return Promise.resolve(store.users[0] ?? null);
        }),
      },
      activityComments: {
        findFirst: vi.fn(() => {
          return Promise.resolve(store.comments[0] ?? null);
        }),
      },
    },
    select: vi.fn().mockReturnValue(createChainableMock([])),
    insert: vi.fn().mockReturnValue(createChainableMock([{ id: "new-id" }])),
    update: vi.fn().mockReturnValue(createChainableMock()),
    delete: vi.fn().mockReturnValue(createChainableMock()),
  };
}
