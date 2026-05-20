-- Per-användare-per-tip last_viewed_at. Används för att räkna ut om ett
-- tips har "ny aktivitet" sedan användaren senast tittade. Saknad rad
-- betyder att användaren aldrig öppnat tipset, vilket vi behandlar som
-- oläst.
--
-- Rapportören får en rad direkt vid submitTip så deras nyss-skickade
-- egna tips inte visas som oläst.
-- Admins får rader när de öppnar admin-modalen.

CREATE TABLE "feedback_tip_views" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tip_id" uuid NOT NULL REFERENCES "feedback_tips"("id") ON DELETE CASCADE,
  "last_viewed_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "tip_id")
);

-- Hjälpindex för "alla mina olästa" på admin-sidan
CREATE INDEX "feedback_tip_views_user_viewed_idx"
  ON "feedback_tip_views" ("user_id", "last_viewed_at");
