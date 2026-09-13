# Gym Companion

Build a full-featured, mobile-first workout tracking and generation app designed specifically for iOS (latest Human Interface Guidelines). The app must feature a dark-mode native aesthetic (SF Pro font, translucent blur surfaces, subtle accent colors, crisp typography, and large touch targets designed for gym use).

---

### 1. CORE CONCEPT & USER GOALS

The app helps users build, customize, and log workouts based on three key dynamic constraints:

1. Available Time (e.g., 15, 30, 45, 60, 90 mins).

2. Available Gym Equipment (selectable equipment profiles: Full Commercial Gym, Hotel Gym, Home Dumbbells Only, Bodyweight, or custom check-list).

3. Target Muscle Groups (e.g., Chest, Back, Quads, Shoulders, Arms, Core, Full Body).

---

### 2. KEY FEATURES & PT-LEVEL DETAILS

#### A. Smart Workout Generator Engine

- Input screen: Select duration (slider/buttons), toggle available equipment, and tap target muscle groups.

- Logic:

  - If 30 mins: Generate 3-4 heavy compound movements with shorter rest suggestions ( supersets or 60s rest).

  - If 60+ mins: Generate warm-up + main compound lifts + accessory/isolation exercises.

- Automatically filter the exercise database to ONLY include exercises matching the user's selected equipment.

#### B. In-Gym Live Workout Tracker (The "In the Zone" View)

- Large, bold text & oversized buttons (easy to tap with sweaty fingers).

- **Set Logging Table:**

  - Displays Set #, Warmup vs. Working set toggle, Previous Weight/Reps hint, Input for Weight (kg/lbs toggle), Input for Reps, and a quick "Checkmark" button to complete the set.

  - Auto-prefill inputs with values from the previous completed set or previous session for effortless tracking.

- **On-The-Fly Exercise Swapping:**

  - Beside each exercise, include a "Swap" button.

  - Tapping "Swap" shows a list of alternative exercises targeting the *exact same primary muscle group* and matching *currently available equipment* (e.g., if Cable Crossover is taken, suggest Dumbbell Flyes or Resistance Band Flyes).

- **Automatic Rest Timer:**

  - Starting when a set checkmark is tapped, a subtle top banner/floating timer counts down (60s, 90s, 120s configurable).

  - Triggers a haptic alert/visual flash when rest is complete.

- **Exercise Notes & Form Hints:** Quick collapsible accordion showing cue bullet points (e.g., "Keep elbows tucked at 45 degrees").

#### C. Gym Equipment Profile Manager

- A dedicated screen to save equipment setups (e.g., "My Home Gym", "Fitness First Downtown", "Hotel / Travel").

- Toggle items: Barbells, Dumbbells, Cables, Smith Machine, Resistance Bands, Kettlebells, Pull-up Bar, Leg Press, Adjustable Bench, Pin-Loaded Machines.

#### D. History & Progressive Overload Tracking

- Calendar/List view of past completed workouts.

- "Personal Record" (PR) badges displayed when a user exceeds max weight or max volume on an exercise.

- Visual volume progress charts per muscle group.

---

### 3. iOS DESIGN & UI/UX SPECIFICATIONS

- **Theme:** iOS Native Dark Mode (`#000000` true dark background, glassmorphism card surfaces with subtle borders, vibrant primary accent like Neon Electric Green or Electric Blue).

- **Navigation:** iOS-style bottom floating tab bar with blur backdrop:

  1. **Workout** (Home / Quick Start / Generator)

  2. **Equipment** (Saved profiles)

  3. **History** (Logs & Stats)

  4. **Exercises** (Full searchable library)

- **Controls:** Wheel pickers for numbers/time, rounded action buttons, smooth sheet slide-ups for exercise swaps and set details.

- **Safe Areas:** Ensure top header padding for the iPhone Dynamic Island / Notch and bottom safe area padding for home indicator bar.

---

### 4. DATA MODEL & STRUCTURE (Local Storage / Supabase ready)

- **Exercise Model:** `id`, `name`, `primary_muscle`, `secondary_muscles`, `equipment_required` (array), `movement_pattern` (push, pull, hinge, squat, carry), `instructions` (brief text).

- **Workout Model:** `id`, `date`, `duration_minutes`, `target_muscles`, `completed_sets` (array of `{exercise_id, set_number, set_type, weight, reps, completed_at}`).

- **Equipment Profile:** `id`, `name`, `active_equipment_ids`.

---

### 5. SAMPLE SEED DATA

Include a starter library of at least 25 common gym exercises across Barbells, Dumbbells, Cables, Bodyweight, and Machines covering all major muscle groups with assigned movement patterns for the swap logic.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
