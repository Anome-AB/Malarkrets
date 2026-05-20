-- Splittar last_activity_at i två rollspecifika kolumner så oläst-signalen
-- blir asymmetrisk: admin ser oläst när rapportören gjort något nytt;
-- rapportör ser nytt när en admin svarat eller ändrat status. Tidigare
-- bumpade vi en gemensam timestamp på varje aktivitet, vilket gjorde att
-- admin B fick oläst-prick när admin A svarade, vilket var brus.
--
-- last_activity_at finns kvar för sortering (det vi använder i listorna
-- för "nyast aktivitet överst") och bumpas via befintliga triggern.

ALTER TABLE "feedback_tips"
  ADD COLUMN "last_reporter_activity_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "last_admin_activity_at" timestamp;

-- Backfill: rapportörens senaste aktivitet är max av tipsets created_at
-- och senaste comment skriven av en icke-admin. Admins senaste aktivitet
-- är max-comment skriven av en admin (NULL om aldrig).
UPDATE "feedback_tips" ft SET
  "last_reporter_activity_at" = GREATEST(
    ft.created_at,
    COALESCE(
      (SELECT MAX(ftc.created_at)
       FROM "feedback_tip_comments" ftc
       JOIN "users" u ON ftc.author_id = u.id
       WHERE ftc.tip_id = ft.id AND u.is_admin = false),
      ft.created_at
    )
  ),
  "last_admin_activity_at" = (
    SELECT MAX(ftc.created_at)
    FROM "feedback_tip_comments" ftc
    JOIN "users" u ON ftc.author_id = u.id
    WHERE ftc.tip_id = ft.id AND u.is_admin = true
  );

CREATE INDEX "feedback_tips_last_reporter_activity_idx"
  ON "feedback_tips" ("last_reporter_activity_at" DESC);

CREATE INDEX "feedback_tips_last_admin_activity_idx"
  ON "feedback_tips" ("last_admin_activity_at" DESC);
