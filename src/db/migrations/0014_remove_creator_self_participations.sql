-- Arrangören är implicit deltagare och ska inte ha en egen rad i
-- activity_participants. Tidigare saknade joinActivity-action:en denna
-- guard så det är möjligt att rader hunnit skapas. Rensar bort dem så
-- modellen blir konsekvent.
--
-- joinActivity-action:en hindrar nu nya inserts av samma typ; UI:t i sin
-- tur visar inte heller anmäl-knappar för arrangören på sin egen aktivitet
-- (creator-footern istället för Kommer/Intresserad-knappar).

DELETE FROM "activity_participants" ap
USING "activities" a
WHERE ap.activity_id = a.id
  AND ap.user_id = a.creator_id;
