import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  integer,
  serial,
  varchar,
  jsonb,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
  unique,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const genderEnum = pgEnum("gender", [
  "man",
  "kvinna",
  "ej_angett",
]);

export const genderRestrictionEnum = pgEnum("gender_restriction", [
  "alla",
  "kvinnor",
  "man",
]);

export const participantStatusEnum = pgEnum("participant_status", [
  "interested",
  "attending",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "activity_updated",
  "participant_joined",
  "participant_left",
  "activity_deleted",
  "activity_cancelled",
  "activity_edited_by_admin",
]);

export const adminActionTypeEnum = pgEnum("admin_action_type", [
  "activity_edited",
  "activity_cancelled",
  "activity_deleted",
  "activity_restored",
  "user_banned",
  "user_unbanned",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const feedbackRatingEnum = pgEnum("feedback_rating", [
  "positive",
  "neutral",
  "negative",
]);

export const experienceLevelEnum = pgEnum("experience_level", [
  "nybörjare",
  "medel",
  "avancerad",
  "alla",
]);

// ─── Custom types ───────────────────────────────────────────────────────────

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return value;
  },
});

// ─── Tables ──────────────────────────────────────────────────────────────────

export const images = pgTable("images", {
  id: uuid().defaultRandom().primaryKey(),
  data: bytea("data").notNull(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  birthDate: date("birth_date"),
  gender: genderEnum().default("ej_angett"),
  avatarUrl: text("avatar_url"),
  location: text(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  bannedBy: uuid("banned_by"),
  municipalityId: varchar("municipality_id", { length: 100 }).default(
    "vasteras",
  ),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interestTags = pgTable("interest_tags", {
  id: serial().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userInterests = pgTable(
  "user_interests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => interestTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tagId] })],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique().on(table.blockerId, table.blockedId),
    check("blocker_not_self", sql`${table.blockerId} != ${table.blockedId}`),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid().defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text().notNull(),
    description: text().notNull(),
    location: text().notNull(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    imageThumbUrl: text("image_thumb_url"),
    imageMediumUrl: text("image_medium_url"),
    imageOgUrl: text("image_og_url"),
    colorTheme: text("color_theme"),
    maxParticipants: integer("max_participants"),
    genderRestriction: genderRestrictionEnum("gender_restriction").default(
      "alla",
    ),
    minAge: integer("min_age"),
    whatToExpect: jsonb("what_to_expect"),
    municipalityId: varchar("municipality_id", { length: 100 }).default(
      "vasteras",
    ),
    cancelledAt: timestamp("cancelled_at"),
    cancelledReason: text("cancelled_reason"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    deletedReason: text("deleted_reason"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("activities_start_time_idx").on(table.startTime),
    index("activities_filter_idx").on(
      table.genderRestriction,
      table.minAge,
      table.startTime,
    ),
    index("activities_deleted_at_idx").on(table.deletedAt),
  ],
);

export const activityTags = pgTable(
  "activity_tags",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => interestTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.tagId] })],
);

export const activityParticipants = pgTable(
  "activity_participants",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: participantStatusEnum().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.userId] })],
);

export const activityComments = pgTable("activity_comments", {
  id: uuid().defaultRandom().primaryKey(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  content: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityFeedback = pgTable(
  "activity_feedback",
  {
    id: uuid().defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: feedbackRatingEnum().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique().on(table.activityId, table.userId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum().notNull(),
    activityId: uuid("activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),
    params: jsonb(),
    read: boolean().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("notifications_user_read_idx").on(
      table.userId,
      table.read,
      table.createdAt,
    ),
  ],
);

export const reports = pgTable("reports", {
  id: uuid().defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id),
  reportedUserId: uuid("reported_user_id").references(() => users.id),
  reportedActivityId: uuid("reported_activity_id").references(
    () => activities.id,
  ),
  reportedCommentId: uuid("reported_comment_id").references(
    () => activityComments.id,
  ),
  reason: text().notNull(),
  status: reportStatusEnum().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid().defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actionType: adminActionTypeEnum("action_type").notNull(),
    targetActivityId: uuid("target_activity_id").references(
      () => activities.id,
      { onDelete: "set null" },
    ),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceReportId: uuid("source_report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    reason: text().notNull(),
    diff: jsonb(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("admin_actions_admin_idx").on(table.adminId, table.createdAt),
    index("admin_actions_activity_idx").on(
      table.targetActivityId,
      table.createdAt,
    ),
    index("admin_actions_user_idx").on(table.targetUserId, table.createdAt),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    metadata: jsonb(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("analytics_event_type_idx").on(table.eventType, table.createdAt),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  interests: many(userInterests),
  blocksGiven: many(userBlocks, { relationName: "blocksGiven" }),
  blocksReceived: many(userBlocks, { relationName: "blocksReceived" }),
  createdActivities: many(activities),
  participations: many(activityParticipants),
  comments: many(activityComments),
  feedback: many(activityFeedback),
  notifications: many(notifications),
  reportsFiled: many(reports, { relationName: "reportsFiled" }),
  reportsReceived: many(reports, { relationName: "reportsReceived" }),
  analyticsEvents: many(analyticsEvents),
}));

export const interestTagsRelations = relations(interestTags, ({ many }) => ({
  userInterests: many(userInterests),
  activityTags: many(activityTags),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, {
    fields: [userInterests.userId],
    references: [users.id],
  }),
  tag: one(interestTags, {
    fields: [userInterests.tagId],
    references: [interestTags.id],
  }),
}));

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [userBlocks.blockerId],
    references: [users.id],
    relationName: "blocksGiven",
  }),
  blocked: one(users, {
    fields: [userBlocks.blockedId],
    references: [users.id],
    relationName: "blocksReceived",
  }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  creator: one(users, {
    fields: [activities.creatorId],
    references: [users.id],
  }),
  tags: many(activityTags),
  participants: many(activityParticipants),
  comments: many(activityComments),
  feedback: many(activityFeedback),
  notifications: many(notifications),
}));

export const activityTagsRelations = relations(activityTags, ({ one }) => ({
  activity: one(activities, {
    fields: [activityTags.activityId],
    references: [activities.id],
  }),
  tag: one(interestTags, {
    fields: [activityTags.tagId],
    references: [interestTags.id],
  }),
}));

export const activityParticipantsRelations = relations(
  activityParticipants,
  ({ one }) => ({
    activity: one(activities, {
      fields: [activityParticipants.activityId],
      references: [activities.id],
    }),
    user: one(users, {
      fields: [activityParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const activityCommentsRelations = relations(
  activityComments,
  ({ one }) => ({
    activity: one(activities, {
      fields: [activityComments.activityId],
      references: [activities.id],
    }),
    user: one(users, {
      fields: [activityComments.userId],
      references: [users.id],
    }),
  }),
);

export const activityFeedbackRelations = relations(
  activityFeedback,
  ({ one }) => ({
    activity: one(activities, {
      fields: [activityFeedback.activityId],
      references: [activities.id],
    }),
    user: one(users, {
      fields: [activityFeedback.userId],
      references: [users.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [notifications.activityId],
    references: [activities.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: "reportsFiled",
  }),
  reportedUser: one(users, {
    fields: [reports.reportedUserId],
    references: [users.id],
    relationName: "reportsReceived",
  }),
  reportedActivity: one(activities, {
    fields: [reports.reportedActivityId],
    references: [activities.id],
  }),
  reportedComment: one(activityComments, {
    fields: [reports.reportedCommentId],
    references: [activityComments.id],
  }),
}));

export const analyticsEventsRelations = relations(
  analyticsEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [analyticsEvents.userId],
      references: [users.id],
    }),
  }),
);

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
    relationName: "adminActionsByAdmin",
  }),
  targetActivity: one(activities, {
    fields: [adminActions.targetActivityId],
    references: [activities.id],
  }),
  targetUser: one(users, {
    fields: [adminActions.targetUserId],
    references: [users.id],
    relationName: "adminActionsAgainstUser",
  }),
  sourceReport: one(reports, {
    fields: [adminActions.sourceReportId],
    references: [reports.id],
  }),
}));

// ─── TypeScript Types ────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type InterestTag = typeof interestTags.$inferSelect;
export type NewInterestTag = typeof interestTags.$inferInsert;

export type UserInterest = typeof userInterests.$inferSelect;
export type NewUserInterest = typeof userInterests.$inferInsert;

export type UserBlock = typeof userBlocks.$inferSelect;
export type NewUserBlock = typeof userBlocks.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type ActivityTag = typeof activityTags.$inferSelect;
export type NewActivityTag = typeof activityTags.$inferInsert;

export type ActivityParticipant = typeof activityParticipants.$inferSelect;
export type NewActivityParticipant = typeof activityParticipants.$inferInsert;

export type ActivityComment = typeof activityComments.$inferSelect;
export type NewActivityComment = typeof activityComments.$inferInsert;

export type ActivityFeedback = typeof activityFeedback.$inferSelect;
export type NewActivityFeedback = typeof activityFeedback.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type AdminAction = typeof adminActions.$inferSelect;
export type NewAdminAction = typeof adminActions.$inferInsert;

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
