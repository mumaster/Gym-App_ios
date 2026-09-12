CREATE TABLE public.exercises (
  id text PRIMARY KEY,
  name text NOT NULL,
  primary_muscle text NOT NULL,
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment_required text[] NOT NULL DEFAULT '{}',
  movement_pattern text NOT NULL DEFAULT 'push',
  compound boolean NOT NULL DEFAULT false,
  instructions text NOT NULL DEFAULT '',
  cues text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exercises are readable by everyone" ON public.exercises FOR SELECT USING (true);
CREATE POLICY "Anyone can add exercises" ON public.exercises FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update exercises" ON public.exercises FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete exercises" ON public.exercises FOR DELETE USING (true);

INSERT INTO public.exercises (id, name, primary_muscle, secondary_muscles, equipment_required, movement_pattern, compound, instructions, cues, sort_order) VALUES
('bb-bench','Barbell Bench Press','Chest',ARRAY['Shoulders','Arms']::text[],ARRAY['barbell','bench']::text[],'push',true,'Press the bar from mid-chest to lockout with a stable arch and planted feet.',ARRAY['Keep elbows tucked at 45 degrees','Squeeze shoulder blades down and back','Bar path in a slight arc toward the eyes']::text[],0),
('db-bench','Dumbbell Bench Press','Chest',ARRAY['Shoulders','Arms']::text[],ARRAY['dumbbell','bench']::text[],'push',true,'Press dumbbells from chest level until they nearly touch overhead.',ARRAY['Wrists stacked over elbows','Control the eccentric for 2 seconds']::text[],1),
('incline-db-press','Incline Dumbbell Press','Chest',ARRAY['Shoulders']::text[],ARRAY['dumbbell','bench']::text[],'push',true,'Bench at 30 degrees, press dumbbells up and slightly together.',ARRAY['Don''t flare elbows past 60 degrees','Stop 1 inch short of lockout']::text[],2),
('cable-crossover','Cable Crossover','Chest','{}'::text[],ARRAY['cable']::text[],'push',false,'Sweep handles together in front of the sternum with a soft elbow bend.',ARRAY['Lead with the elbows, not the hands','Pause 1s at peak contraction']::text[],3),
('db-fly','Dumbbell Flye','Chest','{}'::text[],ARRAY['dumbbell','bench']::text[],'push',false,'Open the arms wide in an arc, then hug back to the top.',ARRAY['Fixed elbow angle throughout','Stretch, don''t drop']::text[],4),
('band-fly','Resistance Band Flye','Chest','{}'::text[],ARRAY['bands']::text[],'push',false,'Anchor bands behind you and press the hands together at chest height.',ARRAY['Keep tension at the start position','Ribs down']::text[],5),
('pushup','Push-Up','Chest',ARRAY['Core','Arms']::text[],ARRAY['bodyweight']::text[],'push',true,'Lower the chest to the floor keeping a straight line head to heel.',ARRAY['Squeeze glutes to lock the ribcage','Elbows at 45 degrees']::text[],6),
('pullup','Pull-Up','Back',ARRAY['Arms']::text[],ARRAY['pullup_bar']::text[],'pull',true,'Pull the chest toward the bar from a dead hang.',ARRAY['Start each rep from full hang','Drive elbows down to the pockets']::text[],7),
('lat-pulldown','Lat Pulldown','Back',ARRAY['Arms']::text[],ARRAY['cable_high']::text[],'pull',true,'Pull the bar to the upper chest with a slight torso lean.',ARRAY['Chest up, no swinging','Think elbows to hips']::text[],8),
('bb-row','Barbell Bent-Over Row','Back',ARRAY['Arms','Hamstrings']::text[],ARRAY['barbell']::text[],'pull',true,'Hinge to 45 degrees and row the bar to the lower ribs.',ARRAY['Neutral spine, brace hard','Pull to the belly button']::text[],9),
('db-row','One-Arm Dumbbell Row','Back',ARRAY['Arms']::text[],ARRAY['dumbbell','bench']::text[],'pull',true,'Support on a bench and row the dumbbell to the hip.',ARRAY['Don''t rotate the torso','Full stretch at the bottom']::text[],10),
('seated-cable-row','Seated Cable Row','Back',ARRAY['Arms']::text[],ARRAY['cable']::text[],'pull',true,'Row the handle to the navel, keeping the torso upright.',ARRAY['Shoulders down away from ears','Pause 1s at the squeeze']::text[],11),
('band-row','Resistance Band Row','Back',ARRAY['Arms']::text[],ARRAY['bands']::text[],'pull',false,'Anchor the band at chest height and row the handles to the ribs.',ARRAY['Squeeze the mid-back','Slow return']::text[],12),
('inverted-row','Inverted Row','Back',ARRAY['Arms','Core']::text[],ARRAY['bodyweight','pullup_bar']::text[],'pull',true,'Hang under a bar and pull the chest to it with a rigid body.',ARRAY['Body in one straight line','Chest touches the bar']::text[],13),
('ohp','Standing Overhead Press','Shoulders',ARRAY['Arms','Core']::text[],ARRAY['barbell']::text[],'push',true,'Press the bar overhead and finish with biceps by the ears.',ARRAY['Squeeze glutes, no back lean','Head through at lockout']::text[],14),
('db-shoulder-press','Seated Dumbbell Shoulder Press','Shoulders',ARRAY['Arms']::text[],ARRAY['dumbbell','bench']::text[],'push',true,'Press dumbbells from ear height to overhead.',ARRAY['Elbows slightly in front of the body','Ribs down']::text[],15),
('lateral-raise','Dumbbell Lateral Raise','Shoulders','{}'::text[],ARRAY['dumbbell']::text[],'push',false,'Raise the dumbbells out to shoulder height with a soft elbow.',ARRAY['Lead with the elbows','No momentum — 2s down']::text[],16),
('cable-lateral','Cable Lateral Raise','Shoulders','{}'::text[],ARRAY['cable']::text[],'push',false,'Raise the handle across the body out to the side.',ARRAY['Constant tension at the bottom','Stop at shoulder height']::text[],17),
('face-pull','Cable Face Pull','Shoulders',ARRAY['Back']::text[],ARRAY['cable_high']::text[],'pull',false,'Pull the rope to the forehead, rotating the hands back.',ARRAY['High elbows','Externally rotate at the end range']::text[],18),
('bb-curl','Barbell Curl','Arms','{}'::text[],ARRAY['barbell']::text[],'pull',false,'Curl the bar up without swinging the elbows forward.',ARRAY['Elbows pinned to the ribs','Control the negative']::text[],19),
('db-curl','Dumbbell Curl','Arms','{}'::text[],ARRAY['dumbbell']::text[],'pull',false,'Curl and supinate the dumbbells one or both arms at a time.',ARRAY['Turn the pinky up at the top','No shoulder shrug']::text[],20),
('cable-pushdown','Cable Triceps Pushdown','Arms','{}'::text[],ARRAY['cable_high']::text[],'push',false,'Extend the elbows fully, keeping the upper arms still.',ARRAY['Lock the elbows to your sides','Full lockout squeeze']::text[],21),
('dips','Parallel Bar Dip','Arms',ARRAY['Chest','Shoulders']::text[],ARRAY['bodyweight']::text[],'push',true,'Lower until the upper arms are parallel to the floor, then press up.',ARRAY['Slight forward lean for chest','Shoulders stay packed']::text[],22),
('skullcrusher','Dumbbell Skullcrusher','Arms','{}'::text[],ARRAY['dumbbell','bench']::text[],'push',false,'Lower the dumbbells beside the head and extend back up.',ARRAY['Elbows stay pointed at the ceiling','Stretch behind the head']::text[],23),
('bb-squat','Barbell Back Squat','Quads',ARRAY['Glutes','Core']::text[],ARRAY['barbell']::text[],'squat',true,'Squat to at least parallel with the bar over mid-foot.',ARRAY['Brace as if bracing for a punch','Knees track over toes']::text[],24),
('goblet-squat','Goblet Squat','Quads',ARRAY['Glutes','Core']::text[],ARRAY['dumbbell']::text[],'squat',true,'Hold a dumbbell at the chest and squat between the knees.',ARRAY['Chest tall, elbows inside knees','Sit down, not back']::text[],25),
('leg-press','Leg Press','Quads',ARRAY['Glutes']::text[],ARRAY['leg_press']::text[],'squat',true,'Lower the sled until the knees reach 90 degrees, then press.',ARRAY['Don''t let the lower back round','Never fully lock the knees']::text[],26),
('bulgarian-split','Bulgarian Split Squat','Quads',ARRAY['Glutes']::text[],ARRAY['dumbbell','bench']::text[],'squat',true,'Rear foot elevated, lower the back knee toward the floor.',ARRAY['Front shin near vertical for quads','Drive through the whole foot']::text[],27),
('smith-squat','Smith Machine Squat','Quads',ARRAY['Glutes']::text[],ARRAY['smith']::text[],'squat',true,'Feet slightly forward, squat under the fixed bar path.',ARRAY['Controlled 3s descent','Stay mid-foot loaded']::text[],28),
('leg-extension','Leg Extension','Quads','{}'::text[],ARRAY['leg_developer']::text[],'squat',false,'Extend the knees to full lockout, squeeze, lower slowly.',ARRAY['Pause 1s at the top','Toes slightly up']::text[],29),
('rdl','Barbell Romanian Deadlift','Hamstrings',ARRAY['Glutes','Back']::text[],ARRAY['barbell']::text[],'hinge',true,'Push the hips back with a flat back until you feel a hamstring stretch.',ARRAY['Bar stays against the legs','Soft knees, not bent']::text[],30),
('db-rdl','Dumbbell Romanian Deadlift','Hamstrings',ARRAY['Glutes']::text[],ARRAY['dumbbell']::text[],'hinge',true,'Hinge at the hips lowering the dumbbells along the thighs.',ARRAY['Lats tight, chest proud','Hips drive the movement']::text[],31),
('leg-curl','Seated Leg Curl','Hamstrings','{}'::text[],ARRAY['leg_developer']::text[],'hinge',false,'Curl the pad down under the calves and control the return.',ARRAY['Hips stay down on the seat','3s eccentric']::text[],32),
('kb-swing','Kettlebell Swing','Glutes',ARRAY['Hamstrings','Core']::text[],ARRAY['kettlebell']::text[],'hinge',true,'Hike the bell back and snap the hips to float it to chest height.',ARRAY['It''s a hinge, not a squat','Lock out glutes at the top']::text[],33),
('hip-thrust','Barbell Hip Thrust','Glutes',ARRAY['Hamstrings']::text[],ARRAY['barbell','bench']::text[],'hinge',true,'Drive the hips to full extension with the shoulders on a bench.',ARRAY['Tuck the chin, ribs down','Pause 2s at lockout']::text[],34),
('glute-bridge','Bodyweight Glute Bridge','Glutes',ARRAY['Hamstrings']::text[],ARRAY['bodyweight']::text[],'hinge',false,'Bridge the hips up squeezing the glutes hard at the top.',ARRAY['Posterior tilt at the top','Push through the heels']::text[],35),
('cable-crunch','Cable Crunch','Core','{}'::text[],ARRAY['cable_high']::text[],'core',false,'Kneel and crunch the ribcage toward the pelvis.',ARRAY['Round the spine, don''t hip hinge','Exhale hard at the bottom']::text[],36),
('hanging-leg-raise','Hanging Leg Raise','Core','{}'::text[],ARRAY['pullup_bar']::text[],'core',false,'Raise the legs to hip height without swinging.',ARRAY['Posteriorly tilt the pelvis','No momentum']::text[],37),
('plank','Plank','Core',ARRAY['Shoulders']::text[],ARRAY['bodyweight']::text[],'core',false,'Hold a rigid line from head to heels on the forearms.',ARRAY['Squeeze glutes and quads','Breathe shallow but steady']::text[],38),
('farmer-carry','Farmer''s Carry','Core',ARRAY['Back','Arms']::text[],ARRAY['dumbbell']::text[],'carry',true,'Walk tall with heavy dumbbells at the sides.',ARRAY['Shoulders back and down','Short, quick steps']::text[],39),
('standing-calf','Standing Calf Raise','Calves','{}'::text[],ARRAY['machine']::text[],'push',false,'Rise onto the toes and lower into a deep stretch.',ARRAY['2s pause in the stretch','Full extension at the top']::text[],40),
('db-calf','Dumbbell Calf Raise','Calves','{}'::text[],ARRAY['dumbbell']::text[],'push',false,'Hold dumbbells and raise onto the balls of the feet.',ARRAY['Slow tempo, no bouncing','Stand tall']::text[],41),
('smith-incline-press','Smith Machine Incline Press','Chest',ARRAY['Shoulders','Arms']::text[],ARRAY['smith','bench']::text[],'push',true,'Bench at 30 degrees under the guided bar, press from upper chest to lockout.',ARRAY['Set the bench so the bar lands on the collarbone line','Controlled 2s eccentric']::text[],42),
('smith-flat-press','Smith Machine Flat Press','Chest',ARRAY['Shoulders','Arms']::text[],ARRAY['smith','bench']::text[],'push',true,'Press the guided bar from mid-chest with feet planted and shoulder blades set.',ARRAY['Elbows at 45 degrees','Touch the shirt, don''t bounce']::text[],43),
('smith-rdl','Smith Machine Romanian Deadlift','Hamstrings',ARRAY['Glutes','Back']::text[],ARRAY['smith']::text[],'hinge',true,'Hinge the hips back sliding the guided bar down the thighs.',ARRAY['Weight in the mid-foot','Stop where the hamstrings stop stretching']::text[],44),
('smith-hip-thrust','Smith Machine Hip Thrust','Glutes',ARRAY['Hamstrings']::text[],ARRAY['smith','bench']::text[],'hinge',true,'Shoulders on the bench, drive the guided bar up to full hip extension.',ARRAY['Chin tucked, ribs down','2s squeeze at lockout']::text[],45),
('smith-shoulder-press','Smith Machine Shoulder Press','Shoulders',ARRAY['Arms']::text[],ARRAY['smith','bench']::text[],'push',true,'Seated upright, press the guided bar from chin height to overhead.',ARRAY['No excessive back arch','Full lockout every rep']::text[],46),
('cable-straight-arm-pulldown','Straight-Arm Pulldown','Back',ARRAY['Core']::text[],ARRAY['cable_high']::text[],'pull',false,'With near-straight arms, pull the bar from overhead to the thighs.',ARRAY['Hinge slightly and stay there','Feel the lats, not the triceps']::text[],47),
('rope-pushdown','Rope Triceps Pushdown','Arms','{}'::text[],ARRAY['cable_high']::text[],'push',false,'Push the rope down and spread the ends at the bottom.',ARRAY['Upper arms glued to the ribs','Squeeze 1s at lockout']::text[],48),
('leg-developer-extension','Lever Leg Extension','Quads','{}'::text[],ARRAY['leg_developer']::text[],'squat',false,'Seated on the leg developer, extend the knees to lockout and lower slowly.',ARRAY['Pause 1s at the top','3s negative']::text[],49),
('lying-leg-curl','Lying Leg Curl','Hamstrings',ARRAY['Calves']::text[],ARRAY['leg_developer']::text[],'hinge',false,'Face down, curl the pad toward the glutes and lower under control.',ARRAY['Hips pressed into the pad','Point the toes to bias the hamstrings']::text[],50),
('incline-db-flye','Incline Dumbbell Flye','Chest',ARRAY['Shoulders']::text[],ARRAY['dumbbell','bench']::text[],'push',false,'On a 30 degree bench, open the arms wide in an arc and hug back up.',ARRAY['Fixed soft elbow angle','Stretch, don''t drop']::text[],51),
('decline-pushup','Decline Push-Up','Chest',ARRAY['Shoulders','Core']::text[],ARRAY['bodyweight','bench']::text[],'push',true,'Feet on the bench, lower the chest to the floor in a straight line.',ARRAY['Glutes tight, ribs down','Elbows at 45 degrees']::text[],52),
('incline-db-row','Incline Dumbbell Row','Back',ARRAY['Arms']::text[],ARRAY['dumbbell','bench']::text[],'pull',true,'Chest supported on an incline bench, row both dumbbells to the ribs.',ARRAY['No torso movement','Pause 1s at the top']::text[],53);