# ROAMCAST
## Product Requirements & UX Specification
**Version 1.0 · For Claude Code Implementation**

---

## Contents

1. [Product Overview & Vision](#1-product-overview--vision)
2. [User Roles](#2-user-roles)
3. [Design System & Brand](#3-design-system--brand)
4. [Application Architecture](#4-application-architecture)
5. [Roamer App — All Screens](#5-roamer-app--all-screens)
6. [Follower Experience — All Screens](#6-follower-experience--all-screens)
7. [Data Models](#7-data-models)
8. [Offline & Sync Strategy](#8-offline--sync-strategy)
9. [GPS & Media Specifications](#9-gps--media-specifications)
10. [Mapping & POI Layer](#10-mapping--poi-layer)
11. [Notifications & Email](#11-notifications--email)
12. [Cast / TV Feature](#12-cast--tv-feature)
13. [Tech Stack](#13-tech-stack)
14. [Screen Reference Index](#14-screen-reference-index)

---

## 1. Product Overview & Vision

Roamcast is a mobile-first Progressive Web App (PWA) that allows adventurers to journal their journeys in real time and share those journeys with invited followers in a cinematic, immersive format. It threads the needle between personal journaling and intimate sharing — the experience it creates for followers is not a photo dump but a re-walking of the day.

The origin use case is long-distance trail adventures such as the Camino de Santiago, but the app is designed for any adventure type including hiking, walking tours, cycling, water activities, cruises, and road trips.

### Core Promise

- The adventurer (Roamer) captures moments on the trail with minimal friction
- Followers re-walk the day through an animated map replay with GPS path, moments, and points of interest
- Everything works offline — data is stored locally and uploaded at end of day
- Followers need no app install — they access everything via a browser link

### Key Differentiators

- **Offline-first architecture** — captures moments without connectivity
- **End-of-day upload model** — not real-time streaming
- **Animated replay experience** — map icon moves along the path, moments pause playback
- **POI enrichment** — nearby points of interest detected at upload time and shown along the path
- **Cast to TV** — followers can mirror the replay to their television via Chromecast or AirPlay

---

## 2. User Roles

Roamcast has exactly two user roles. These roles never overlap — a Roamer cannot be a Follower of their own trip, and Followers never access Roamer capture tools. Every screen in this document is clearly labeled with its role.

---

### 🟢 ROAMER — The adventurer on the trail

Uses the mobile PWA installed to their home screen. Creates trips, starts daily sessions, captures moments (photo, video, audio), tracks GPS path, and uploads at end of day.

**Roamer Capabilities:**
- Create and manage trips with name, description, adventure type, dates, followers
- Start and end daily sessions with live GPS tracking
- Capture moments: 30-second max video, photos, 30-second max audio with title and note
- View live session stats: distance in miles, duration, moment count
- Upload day data including GPS track, photos, videos, audio clips
- View follower engagement — who has viewed each day

---

### 🟣 FOLLOWER — The viewer at home

No app install required — all via browser. Receives email notifications when a new day is uploaded, signs in via a passwordless 6-digit code, accesses a personal dashboard, and watches the animated day replay.

**Follower Capabilities:**
- Receive email notification when a new day is uploaded
- Sign in via email + 6-digit OTP code (no password, no app install)
- View follower dashboard showing active trips and past trip history
- Watch animated day replay with GPS path, moment overlays, POI overlays
- Control playback: play, pause, skip to next/previous moment, speed control (1x, 2x)
- Cast replay to TV via Chromecast or AirPlay — phone becomes remote control

---

## 3. Design System & Brand

### Brand

| Property | Value |
|----------|-------|
| App name | Roamcast |
| Logo treatment | `roam` (white) + `cast` (teal #1D9E75) |
| Tone | Warm, personal, adventurous — not corporate |

### Color System

| Token | Hex | Usage |
|-------|-----|-------|
| Brand teal | `#1D9E75` | Primary brand, Roamer CTA buttons, active states |
| Brand purple | `#7F77DD` | Follower role, cast feature, OTP inputs |
| Amber | `#BA7517` | Photo moments — thumbnails, map dots, icons |
| Teal (video) | `#1D9E75` | Video moments — thumbnails, map dots, icons |
| Purple (audio) | `#7F77DD` | Audio moments — thumbnails, map dots, icons |
| Gray (GPS) | `#888780` | GPS track icon, POI markers on map |
| Background primary | `#0f0f0f` | App background — deep dark |
| Surface | `#161616` | Cards, input fields, nav bar |
| Surface elevated | `#1a1a1a` | Hover states, avatars |
| Border default | `#2a2a2a` | All default borders |
| Border active | `#1D9E75` | Selected/active states |
| Text primary | `#ffffff` | Headlines, key values |
| Text secondary | `#aaa` | Body copy, labels |
| Text muted | `#555` | Hints, metadata |
| Text disabled | `#333` | Inactive, placeholders |

### Typography

| Element | Spec |
|---------|------|
| App logo | `font-size: 18-22px, font-weight: 500` |
| Screen title | `font-size: 16px, font-weight: 500, color: #fff` |
| Section heading | `font-size: 11px, font-weight: 500, color: #555, letter-spacing: 0.6px, uppercase` |
| Body / card text | `font-size: 13px, font-weight: 400, color: #ccc` |
| Description / note | `font-size: 11-13px, font-weight: 300, color: #666` |
| Metadata / timestamps | `font-size: 10px, font-weight: 400, color: #444-#555` |
| Badges / pills | `font-size: 9-10px, font-weight: 500` |

### Design Principles

- Flat dark mode only — no gradients, no shadows, no blur effects
- Border radius: 8px (inputs/small), 10-12px (cards), 14-16px (large cards), 32-36px (phone frames)
- Borders: 0.5px default, 1px for selected/active states
- All distance values displayed in **miles (mi)** and **feet (ft)**
- Moment color coding: `teal=video`, `amber=photo`, `purple=audio` — used consistently in thumbnails, map dots, upload queue, and replay
- GPS track icon uses gray (`#888780`) to distinguish from media types

---

## 4. Application Architecture

### Application Type

Roamcast is a **Progressive Web App (PWA)**. It runs in the mobile browser and can be installed to the home screen on both iOS and Android without an app store.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (PWA) | React + Vite, Tailwind CSS, Workbox (Service Worker) |
| Offline storage | IndexedDB for GPS tracks, moment metadata, media blobs |
| Mapping | Mapbox GL JS — custom animated replay, dark map style |
| POI data | Google Places API (enriched at upload time) |
| Backend | Supabase — Postgres database, auth, storage, realtime |
| Media storage | Supabase Storage (S3-compatible) or Cloudflare R2 |
| Email notifications | Resend or Postmark |
| Auth (Roamer) | Supabase Auth with email/password or social sign-in |
| Auth (Follower) | Passwordless OTP — email + 6-digit code, session cookie |
| Cast protocol | Google Cast SDK (Chromecast) + AirPlay via Safari browser |

### Data Flow Summary

1. Roamer captures moments offline → stored in IndexedDB
2. GPS track logged every 60 seconds adaptively → stored in IndexedDB
3. On "End session" → upload queue fires: GPS track, photos, videos, audio
4. At upload time → Google Places API queried for POIs along GPS track → stored with trip data
5. Upload complete → Supabase triggers email notification to all followers
6. Follower clicks email link → lands on sign-in → OTP auth → follower dashboard
7. Follower taps "Watch Day" → animated replay loads from Supabase data

---

## 5. Roamer App — All Screens

> All Roamer screens use teal (`#1D9E75`) as the role color. The app is installed as a PWA.

---

### 🟢 R-1 · Home Screen

**Purpose:** First screen after login. Shows the active trip card and list of past adventures.

**Components:**
- **App header** — Roamcast logo left, user avatar (initials) right
- **Greeting** — current date + "Your adventures"
- **Active trip card** — trip name, day progress, follower count, 3 stats (days/moments/miles), "Start today's session" teal CTA button
- **Past trips** — scrollable cards with adventure type icon, name, stats, "Complete" badge
- **New trip button** — dashed border, quiet secondary style
- **Bottom nav** — Home (active), Trips, Map, Followers, Profile

---

### 🟢 R-2 · New Trip Setup

**Purpose:** 3-step form to create a trip. Step 1 shown: Details → Followers → Settings.

**Components:**
- **Progress bar** — 3px, 3 steps, active step in teal
- **Trip name** — required text input
- **Description** — optional textarea, max 200 chars, `font-weight: 300`, `color: #666`, character counter
- **Adventure type grid** — 2-column, 6 options (Hiking, Walking, Cycling, Water, Cruise, Driving). Selected: teal border + icon + dark bg
- **Dates** — side-by-side start/end date pickers
- **Invite followers** — email input + add button. Followers shown as chips with initials avatar + remove button
- **Continue CTA** — full-width teal. Subtitle: "Followers receive an email invite when you start each day"

---

### 🟢 R-3 · Active Day Session

**Purpose:** Primary screen during an adventure. Stays open all day. Designed for one-handed use.

**Components:**
- **Header** — "Active session" label teal, trip name, "Day X" badge
- **Live GPS map** — dark teal background, completed path `#0f6e56`, active path `#1D9E75` with dashed leading edge, colored moment dots, "GPS tracking" pill
- **Stats row** — Distance (mi), Duration (h m), Moments count
- **Today's moments strip** — horizontal scroll thumbnails, color-coded by type (teal/amber/purple), color legend
- **"Take a moment" button** — large full-width teal, camera icon, subtitle "Photo · Video · Audio"
- **Secondary row** — "View map" + "Followers" buttons
- **"End session & upload"** — intentionally quiet, dark, low contrast to prevent accidental tap
- **Session timer** — teal dot + "Session active · Xh Xm"

---

### 🟢 R-4 · Moment Capture

**Purpose:** Opens when Roamer taps "Take a moment". Three modes via tab selector. Max 30 seconds for video/audio.

**Components:**
- **Header** — back button, title, "GPS locked" pill
- **Mode selector** — 3-tab pill (Photo=amber, Video=teal, Audio=purple)
- **Photo mode** — camera viewfinder, amber corner brackets, capture button in amber
- **Video mode** — viewfinder with teal brackets, recording timer, "Stop & save video" teal button
- **Audio mode** — purple live waveform visualizer replaces viewfinder, "Stop & save audio" purple button
- **Title** — required text input
- **Note** — optional textarea, `font-weight: 300`, `color: #666`
- **Discard** — quiet secondary button below capture CTA

---

### 🟢 R-5 · End of Day Upload

**Purpose:** Shown after tapping "End session & upload". Uploading state and complete state.

**Components:**
- **Day summary card** — trip name, date, route label, Day X badge, 3 stats, mini map
- **Upload queue** — GPS track (gray icon), Photos (amber), Videos (teal), Audio (purple). Each shows file size + uploaded/pending status
- **Progress bar** — percentage + status text
- **Followers notification card** — teal bg, confirms followers will be emailed
- **Complete state** — large teal checkmark, "Day X complete", breakdown by type, follower confirmation

---

## 6. Follower Experience — All Screens

> All Follower screens use purple (`#7F77DD`) as the role color. No app install required.

---

### 🟣 F-6 · Email Notification

**Purpose:** HTML email sent when a day upload completes.

**Components:**
- **Header** — dark teal background, Roamcast logo
- **Personalized greeting** — "Hi [Name],"
- **Headline** — "Day X of [Trip Name] is ready"
- **Body copy** — route, distance, duration, moment count
- **Trip preview card** — adventure icon, trip name, stats, mini map with moment dots
- **CTA button** — "Watch Day X on Roamcast" in full-width teal
- **Footer** — manage preferences + unsubscribe links

---

### 🟣 F-7 · Sign In — Email Entry

**Purpose:** First screen when follower clicks the email link. Zero friction.

**Components:**
- Roamcast logo centered
- Subtitle personalized to Roamer's name
- Email field pre-filled from URL parameter
- "Send sign-in code" teal CTA
- Hint: "We'll send a 6-digit code. No password needed."

---

### 🟣 F-8 · Sign In — Enter Code

**Purpose:** OTP verification. Supports paste from email client.

**Components:**
- **6 individual digit boxes** — single horizontal row, height 48px each
- Filled boxes: purple border. Empty: gray. Active: blinking purple cursor
- **"Paste code from email"** — secondary button, fills all 6 boxes on paste. Success banner on paste.
- **"Verify & sign in"** — full-width teal CTA
- **Resend code** link + "Code expires in 10 minutes"
- On success: 30-day session cookie, redirect to dashboard

---

### 🟣 F-9 · Follower Dashboard

**Purpose:** Follower's home. Bookmarkable — returning users with valid session skip sign-in.

**Components:**
- **Header** — Roamcast logo, follower initials avatar in purple
- **Greeting** — "Welcome back" + "Hi, [Name]"
- **Active trips** — trip cards with teal border, "New" badge for unread days, day dot strip, mini map, "Watch Day X" button
- **Day dot strip** — solid teal=viewed, bright teal=new/unread, gray=upcoming
- **Past trips** — completed trips with stats and "View trip" button
- **Bottom nav** — Home (active, purple), Trips, Profile

---

### 🟣 F-10a · Day Replay — Playing

**Purpose:** Cinematic replay. Animated icon moves along GPS path with moments and POIs.

**Components:**
- **Header** — back, "Day X · [Route]" + trip name subtitle, menu
- **Replay map** — completed path `#0f4a35`, active segment `#1D9E75` with dashed leading edge, colored moment + POI dots, current position with pulsing halo, legend pills
- **Playback bar** — time + speed selector (1x/2x) + total. Progress track with moment marker dots. 5 controls: restart, skip back, play/pause (teal), skip forward, skip to end
- **Stats row** — mi so far, moments seen, remaining
- **All moments strip** — horizontal scroll, colored cards by type

---

### 🟣 F-10b · Moment Overlay

**Purpose:** Playback auto-pauses when reaching a moment. Overlay card appears.

**Components:**
- Map remains visible, position dot enlarged
- **Overlay card** — colored border by type, type badge, close button
- **Media area** — inline video player / photo / audio waveform
- **Content** — title, note (font-weight 300), metadata (time + mi)
- **Actions** — "Previous moment" (secondary) + "Continue replay" (teal)

---

### 🟣 F-10c · POI Overlay

**Purpose:** Triggers when animated position passes within ~165ft (50m) of a point of interest.

**Components:**
- Dashed gray line connects position to POI dot on map
- Header: "Point of interest · [X]ft away"
- **POI card** — gray icon, place name, type/era
- Description from Google Places API
- Distance pill + "View on map" teal pill
- **Actions** — "Dismiss" (secondary) + "Continue replay" (teal)

---

### 🟣 F-11a · Cast Device Selection

**Purpose:** Scan local network and select a cast target.

**Components:**
- "Scanning" purple pill indicator
- 56px purple cast icon hero
- **Device list** — each discovered device: icon, name, protocol (Chromecast/Apple TV), status. Selected: purple border + checkmark
- Footer hint: "Your phone becomes the remote control"

---

### 🟣 F-11b · Phone Remote Control

**Purpose:** After casting, phone transforms into a dedicated remote. All state synced in real time.

**Components:**
- "Casting" purple pill indicator
- **Casting status card** — purple bg, device name, protocol, Stop button
- **Now playing card** — moment name, progress bar, skip back + play/pause (large teal) + skip forward
- "Moments" + "Speed" quick action buttons
- **"Jump to moment" strip** — colored pills by type with mi marker

---

### 🟣 F-11c · TV Landscape View

**Purpose:** Full-screen 16:9 experience on television.

**Layout:** Left 2/3 = map panel. Right 1/3 = info panel.

**Left panel:**
- Full GPS path animation in landscape
- Playback timeline bar across bottom with moment dots
- "CAST" purple indicator top-right

**Right panel:**
- Current moment card (video/photo/audio) with title and note
- Nearby POI card when applicable
- "Use phone to control playback" hint at bottom
- All text ~20% larger than mobile for TV viewing distance

---

## 7. Data Models

### Trip

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| roamer_id | UUID, foreign key → users |
| name | string, required, max 100 chars |
| description | string, optional, max 200 chars |
| adventure_type | enum: `hiking \| walking \| cycling \| water \| cruise \| driving` |
| start_date | date |
| end_date | date |
| status | enum: `active \| complete` |
| created_at | timestamp |
| updated_at | timestamp |

### Day

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| trip_id | UUID, foreign key → trips |
| day_number | integer |
| route_label | string, optional (e.g. "Burgos to León") |
| date | date |
| distance_miles | decimal |
| duration_seconds | integer |
| session_start | timestamp |
| session_end | timestamp |
| upload_status | enum: `pending \| uploading \| complete` |
| uploaded_at | timestamp |

### GPS Track

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| day_id | UUID, foreign key → days |
| points | JSONB array of `{lat, lng, timestamp, accuracy}` |
| point_count | integer |
| storage_url | string, URL to compressed GPS file in storage |

### Moment

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| day_id | UUID, foreign key → days |
| type | enum: `photo \| video \| audio` |
| title | string, required, max 100 chars |
| note | string, optional, max 500 chars |
| lat | decimal |
| lng | decimal |
| captured_at | timestamp |
| media_url | string, URL in storage |
| duration_seconds | integer, null for photos |
| file_size_bytes | integer |
| sort_order | integer |

### Point of Interest

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| day_id | UUID, foreign key → days |
| google_place_id | string |
| name | string |
| type | string (e.g. "Historic church · 12th century") |
| description | string from Google Places |
| lat | decimal |
| lng | decimal |
| distance_from_path_ft | integer |
| path_timestamp | timestamp — when Roamer passed closest point |

### Follower

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| trip_id | UUID, foreign key → trips |
| email | string |
| invited_at | timestamp |
| last_viewed_at | timestamp |
| last_viewed_day | integer |
| notification_opt_out | boolean, default false |

### Follower Session

| Field | Type / Notes |
|-------|-------------|
| id | UUID, primary key |
| email | string |
| otp_code | string hashed, 6 digits |
| otp_expires_at | timestamp, 10 minutes from creation |
| session_token | string, set after OTP verification |
| session_expires_at | timestamp, 30 days from creation |
| created_at | timestamp |

---

## 8. Offline & Sync Strategy

### Core Principle

The Roamer app must function without internet. All capture operations write to local storage first. Upload only happens when the Roamer explicitly taps "End session & upload" — and only when connectivity is available.

### Local Storage (IndexedDB)

- GPS track points — array of `{lat, lng, timestamp, accuracy}` objects
- Moment metadata — title, note, type, GPS coordinates, captured_at timestamp
- Media blobs — compressed video, photo, audio files as binary blobs
- Upload queue state — tracks which items have been uploaded vs pending

### GPS Sampling

- Sample rate: **one point every 60 seconds** while session is active
- Force capture: always record a precise GPS point at moment capture time
- Battery optimization: drop to every 5 minutes when battery below 20%
- Implementation: `Geolocation.watchPosition()` with 60-second interval

> 60-second sampling is visually imperceptible at walking speeds and reduces battery drain from ~50% to ~10-15% over an 8-hour day.

### Media Compression

| Type | Target | Method |
|------|--------|--------|
| Video | Under 20MB per 30-sec clip at 720p | MediaRecorder API with target bitrate at record time |
| Photo | Under 2MB | JPEG 80% quality on capture |
| Audio | ~240KB per 30-sec clip | 64kbps AAC |

### Upload Queue

- Upload order: GPS track → photos → videos → audio
- Resumable uploads if connection drops mid-upload
- POI enrichment triggered server-side after GPS track upload completes

---

## 9. GPS & Media Specifications

### GPS Track

| Spec | Value |
|------|-------|
| Sample interval | 60 seconds (5min below 20% battery) |
| Force sample | At every moment capture |
| Format | GeoJSON LineString with timestamps |
| Accuracy threshold | Only store points with accuracy < 50m |

### Video

| Spec | Value |
|------|-------|
| Max duration | 30 seconds |
| Resolution | 720p (1280×720) |
| Target file size | Under 20MB per clip |
| Format | WebM or MP4 |
| Color coding | Teal `#1D9E75` |

### Photo

| Spec | Value |
|------|-------|
| Target file size | Under 2MB |
| Compression | 80% JPEG quality |
| Format | JPEG |
| Color coding | Amber `#BA7517` |

### Audio

| Spec | Value |
|------|-------|
| Max duration | 30 seconds |
| Bitrate | 64kbps AAC |
| Target file size | ~240KB per clip |
| Format | AAC / M4A |
| Color coding | Purple `#7F77DD` |

---

## 10. Mapping & POI Layer

### Map Provider

**Mapbox GL JS** for all map rendering — Roamer active session mini-map and Follower animated replay.

### Map Colors

| Element | Color |
|---------|-------|
| Map background | `#111a14` (dark teal) |
| Grid lines | `#1a2e22` |
| Completed path | `#0f4a35` (dark teal) |
| Active/animated path | `#1D9E75` (bright teal) with dashed leading edge |
| Start point | Gray filled circle |
| Current position | Teal circle + pulsing halo at 15% opacity |

### Moment Dot Colors on Map

| Type | Color |
|------|-------|
| Video | `#1D9E75` (teal) |
| Photo | `#BA7517` (amber) |
| Audio | `#7F77DD` (purple) |
| POI | `#888780` (gray) |

### POI Enrichment

- Triggered server-side after GPS track upload completes
- Query Google Places API for POIs within **50 meters** of any GPS track point
- Results deduplicated and stored in the `poi` table permanently
- During replay: POI overlay triggers when animated position passes within ~165ft (50m) of a POI

### Replay Animation Logic

- Animated icon moves along GPS track, speed calculated from total day duration
- **1x speed:** full day compressed to ~30 seconds of animation
- **2x speed:** halves the animation time
- On reaching a moment timestamp → animation pauses, moment overlay appears
- On reaching a POI proximity → animation pauses, POI overlay appears
- Follower can scrub progress bar to any point in the day

---

## 11. Notifications & Email

### Trigger

Emails sent to all followers when a Roamer's day upload **completes**. Not sent at session start.

### Email Content

- **Subject:** "[Roamer name]'s Day [X] on [Trip Name] is ready to watch"
- **Body:** Route label, distance in miles, duration, moment count
- **Preview card:** Mini map, stats row
- **CTA:** "Watch Day X on Roamcast" → links to follower sign-in
- **Footer:** Unsubscribe + manage preferences

### OTP Flow

1. Follower enters email on sign-in screen
2. 6-digit code generated, hashed, stored with 10-minute expiry
3. Plaintext code emailed to follower
4. On correct code entry: 30-day session cookie set
5. Follower redirected to dashboard
6. Returning followers with valid cookie skip sign-in entirely

### View Tracking

- `last_viewed_at` updated when follower loads dashboard
- `last_viewed_day` updated when follower opens a day replay
- Roamer can see this in the Followers tab
- Day dots on follower dashboard: solid teal = viewed, bright teal = new/unread

---

## 12. Cast / TV Feature

Followers can cast the day replay to their TV. Phone becomes a remote control. Supports Chromecast and AirPlay.

### F-11a · Cast Device Selection

- Cast icon visible in replay header when compatible devices detected
- Shows available Chromecast, Google TV, Apple TV, and AirPlay devices
- Selected device highlighted in purple
- Hint: "Your phone becomes the remote control"

### F-11b · Phone Remote Control

- "Casting" purple indicator in header
- Now playing card with progress bar and play/pause controls
- Skip back + play/pause (large teal primary) + skip forward
- "Jump to moment" strip for direct navigation
- All state synced between phone and TV via WebSocket or Supabase Realtime

### F-11c · TV Landscape View (16:9)

**Left 2/3 — Map panel:**
- Full GPS path animation in landscape
- Playback timeline bar across bottom
- Moment dot legend bottom-left

**Right 1/3 — Info panel:**
- Current moment card (video/photo/audio)
- Nearby POI card when applicable
- "Use phone to control playback" instruction
- All text ~20% larger than mobile for TV viewing distance

---

## 13. Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS |
| PWA / Service Worker | Workbox |
| Offline storage | IndexedDB via Dexie.js |
| Map rendering | Mapbox GL JS |
| POI data | Google Places API (server-side at upload time) |
| Backend / database | Supabase (Postgres + Auth + Storage + Realtime) |
| Media storage | Supabase Storage or Cloudflare R2 |
| Email | Resend or Postmark |
| Follower auth | Custom OTP flow via Supabase Edge Functions |
| Media recording | MediaRecorder API (browser-native) |
| GPS tracking | `Geolocation.watchPosition()` (browser-native) |
| Chromecast | Google Cast SDK |
| AirPlay | Native via Safari on iOS/macOS |
| Hosting | Vercel or Cloudflare Pages |

---

## 14. Screen Reference Index

### Roamer Screens (5 total)

| Screen | Title | Key Action |
|--------|-------|-----------|
| R-1 | Home | Start today's session |
| R-2 | New trip setup | Create trip, invite followers |
| R-3 | Active day session | Take a moment, end session |
| R-4 | Moment capture | Capture photo / video / audio |
| R-5 | End of day upload | Upload + notify followers |

### Follower Screens (10 total)

| Screen | Title | Key Action |
|--------|-------|-----------|
| F-6 | Email notification | Click "Watch Day X" |
| F-7 | Sign in — email | Enter email, send code |
| F-8 | Sign in — enter code | Enter / paste OTP |
| F-9 | Follower dashboard | Watch Day X, view past trips |
| F-10a | Day replay — playing | Play / pause / scrub |
| F-10b | Moment overlay | View moment, continue |
| F-10c | POI overlay | View POI, dismiss, continue |
| F-11a | Cast device selection | Select TV device |
| F-11b | Phone remote control | Control TV playback |
| F-11c | TV landscape view | Cinematic TV experience |

---

*Roamcast Product Spec v1.0 · Prepared for Claude Code implementation*
