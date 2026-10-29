# FlagForge — Frontend Dashboard

A modern, responsive React administration dashboard for managing feature flags, targeting rules, stale flag governance, evaluation analytics, and compliance audit logs.

---

## 🛠 Tech Stack

- **Framework**: React 18 + Vite
- **Routing**: React Router DOM v6
- **Charts & Telemetry**: Recharts
- **HTTP Client**: Axios
- **Styling**: Custom CSS Design System (Theme-aware dark & light modes with CSS variables)
- **Internationalization**: Dual Translation Engine (Google Translate Widget & LibreTranslate API)

---

## 🚀 Quick Start & Development Server

### 1. Installation

Navigate to the `frontend/` folder and install dependencies:

```bash
cd frontend
npm install
```

### 2. Launch Local Development Server

```bash
npm run dev
```

The Vite dev server will start at: [http://localhost:5173](http://localhost:5173)

### 3. Production Build

To test or verify the production bundle:

```bash
npm run build
npm run preview
```

---

## 💻 Key Dashboard Features & Views

### 1. 📊 Telemetry Dashboard (`/dashboard`)
- **Metric Cards**: Active Flags, Total Evaluations, System Uptime, Redis Cache Latency.
- **Analytics Charts**: Hourly evaluation volume trends powered by Recharts.
- **Environment Switcher**: Seamlessly switch context between Development, Staging, and Production.

### 2. 🏁 Flag Catalog (`/flags`)
- List and search feature flags with environment-specific toggles.
- Filter by Flag Type (Boolean, String, Number) or Owner Team.
- Modal dialog to create new flags across all environments simultaneously.

### 3. ⚙️ Flag Detail & Rule Editor (`/flags/:key`)
- **5-Tier Targeting Configurator**:
  - **User Whitelist**: Exact user ID targeting.
  - **Group Membership**: Target specific user cohorts (e.g. `beta_testers`, `internal_team`).
  - **Percentage Rollouts**: Gradual user rollout slider (0% to 100%).
  - **Environment Overrides**: Set environment-specific override values.
  - **Default Value Fallback**: Set base fallback values.
- **Version History & Rollback**: View timestamped configuration history and revert to previous versions with a single click.

### 4. 🧹 Cleanup & Governance (`/flags` -> Stale Flags Tab)
- Identifies flags that are 100% rolled out or 100% disabled for >30 days.
- Allows release engineers to review and mark stale candidates for code cleanup.

### 5. 📜 Audit Logging (`/audit-log`)
- Immutable compliance history tracking every create, update, toggle, and delete action.
- Search and filter logs by actor email, flag key, environment, or date range.

### 6. 🌐 Dual Translation Engine (`/settings`)
- Simple toggle pill in Settings allowing users to choose their preferred translation provider:
  - **🔤 Google Translate Widget**: Instant browser-level translation across 10 languages.
  - **🌐 LibreTranslate (Self-Hosted)**: Privacy-first REST API integration with Docker server support.

---

## 📱 Responsive Design Breakpoints

The UI is optimized for screens of all sizes:
- **Desktop (`> 1024px`)**: Full sidebar navigation & multi-column telemetry grid.
- **Tablet (`768px - 1024px`)**: Single-column layout with compact sidebar.
- **Mobile (`< 768px`)**: Stacked navbar, horizontal scroll tables, touch-friendly touch targets.

---

## 🧩 Component Architecture

The frontend follows a modular component architecture organized by feature domain.

### Directory Structure

```text
frontend/src/
├── api/
│   └── client.js                  # Axios instance with base URL config
├── components/
│   ├── dashboard/                 # Dashboard-specific widgets
│   ├── flags/
│   │   └── CreateFlagModal.jsx    # Flag creation modal dialog
│   ├── layout/
│   │   ├── Layout.jsx             # Root layout shell (sidebar + content)
│   │   ├── Sidebar.jsx            # Collapsible sidebar navigation
│   │   ├── Navbar.jsx             # Top navigation bar with user menu
│   │   ├── EnvironmentSwitcher.jsx # Environment context dropdown
│   │   ├── LanguageSelector.jsx   # Language picker for translations
│   │   └── GoogleTranslateWidget.jsx # Google Translate embed component
│   ├── settings/
│   │   ├── TranslationEngineSettings.jsx # Engine toggle (Google vs LibreTranslate)
│   │   └── LibreTranslateSettings.jsx    # LibreTranslate configuration panel
│   └── ui/                        # Shared reusable UI primitives
├── context/
│   ├── AuthContext.jsx            # Authentication state + JWT management
│   └── TranslationContext.jsx     # Translation engine state + LibreTranslate API
├── pages/
│   ├── LandingPage.jsx            # Public landing page with auth forms
│   ├── OAuthCallback.jsx          # OAuth redirect handler
│   ├── Dashboard.jsx              # Telemetry metrics dashboard
│   ├── Flags.jsx                  # Flag catalog list + search
│   ├── FlagDetail.jsx             # Flag editor with targeting + analytics
│   ├── Environments.jsx           # Environment CRUD management
│   ├── AuditLog.jsx               # Compliance audit log viewer
│   ├── Teams.jsx                  # User group management
│   └── Settings.jsx               # Translation engine settings
├── routes/
│   └── AppRoutes.jsx              # Route definitions + auth guards
├── styles/                        # Additional CSS modules
├── index.css                      # Global CSS design system (~50KB)
├── main.jsx                       # React DOM entry point
└── App.jsx                        # Root application component
```

---

## 📄 Page-by-Page Reference

### 🏠 Landing Page (`/`)
- **Public page** — no authentication required.
- Contains login and registration forms with email/password fields.
- Social OAuth buttons for Google and GitHub sign-in.
- Animated hero section showcasing FlagForge capabilities.
- Redirects to `/dashboard` upon successful authentication.

### 📊 Telemetry Dashboard (`/dashboard`)
- **Metric Cards**: Displays key system stats:
  - Active Flags count (enabled flags in current environment)
  - Total Evaluations (aggregated from analytics)
  - System Uptime indicator
  - Redis Cache Latency measurement
- **Analytics Charts**: Recharts-powered line/area charts showing hourly evaluation volume trends.
- **Environment Switcher**: Context selector that filters all dashboard data by environment.
- Auto-refreshes metrics on environment change.

### 🏁 Flag Catalog (`/flags`)
- **Flag List**: Sortable, searchable table of all feature flags in the selected environment.
- **Quick Toggle**: Inline switch to enable/disable flags directly from the list view.
- **Filters**: Filter by flag type (`boolean`, `string`, `number`) and owner team.
- **Create Flag Modal**: Opens a dialog to define new flags with:
  - Flag key (URL-safe identifier)
  - Display name and description
  - Flag type selector
  - Default value input (validates against selected type)
  - Owner team assignment
  - Target environment picker
- **Stale Flags Tab**: Embedded cleanup governance view showing candidates for code removal.

### ⚙️ Flag Detail & Rule Editor (`/flags/:key`)
This is the most feature-rich page (~78KB), providing comprehensive flag management:

**Targeting Rule Editor:**
- **User Whitelist**: Text input for comma-separated user IDs (Tier 1).
- **Group Membership**: Multi-select dropdown to target user groups (Tier 2).
- **Percentage Rollout**: Interactive slider (0%–100%) with visual indicator (Tier 3).
- All rules are saved atomically via `POST /flags/{key}/targeting`.

**Environment Overrides Panel:**
- Displays override status for each environment (Overridden vs Using Default).
- Toggle to activate/deactivate overrides per environment.
- Value editor respecting the flag's type.

**Evaluation Tester:**
- Live evaluation form: input `user_id`, `groups`, and `context` and see the real-time result.
- Displays the full 5-tier priority cascade with which tier matched.
- Shows latency, cache status, and rule detail explanation.

**Analytics Charts:**
- Timeframe selector: 7D / 30D / 90D.
- Line chart showing daily evaluation volumes.
- Period-over-period change percentage badge.
- Seed button to generate sample analytics data for demos.

**Version History & Rollback:**
- Timestamped list of configuration snapshots.
- One-click rollback to any previous version.

### 🌍 Environments (`/environments`)
- Full CRUD management for deployment environments.
- Create new environments with name and description.
- Edit existing environment metadata.
- Delete environments (with cascade warning).
- Displays flag count per environment.

### 📜 Audit Log (`/audit-log`)
- **Immutable compliance history viewer** (~46KB component) with advanced filtering:
  - Filter by **actor email** (who made the change)
  - Filter by **flag key** (which flag was affected)
  - Filter by **environment** (where the change occurred)
  - Filter by **action type** (CREATE, UPDATE, ENABLE, DISABLE, DELETE, TARGETING)
  - Filter by **date range** (start and end dates)
- Chronologically ordered entries (newest first).
- Expandable rows showing `previous_state` and `new_state` JSON diffs.

### 👥 Teams & Groups (`/teams`)
- View all user groups with member counts.
- Create new groups.
- Delete individual or batch-delete multiple groups.
- Expand groups to view, add, and remove members.
- Member management with user ID input.

### ⚙️ Settings (`/settings`)
- **Translation Engine Selector**: Toggle pill switching between:
  - **Google Translate Widget**: Browser-level translation (100+ languages).
  - **LibreTranslate**: Self-hosted API with manual translation controls.
- **LibreTranslate Settings Panel**: Configure API URL, test connectivity, view available languages.

---

## 🧠 React Context Providers

### `AuthContext` — Authentication State

Manages the full authentication lifecycle:

```jsx
const { user, token, isAuthenticated, loading, login, logout } = useAuth()
```

| Property | Type | Description |
|:---------|:-----|:------------|
| `user` | `object \| null` | Current user profile (id, email, full_name, avatar_url, provider) |
| `token` | `string \| null` | JWT access token |
| `isAuthenticated` | `boolean` | Whether user has a valid token |
| `loading` | `boolean` | True while checking stored token on mount |
| `login(token, user)` | `function` | Stores credentials and sets auth state |
| `logout()` | `function` | Clears credentials and redirects to landing |

**Token persistence**: JWT and user profile are stored in `localStorage` and rehydrated on app mount. The `Authorization: Bearer <token>` header is automatically attached to all Axios requests.

### `TranslationContext` — Internationalization State

Manages dual translation engine state:

```jsx
const { engine, setEngine, translate, isLoading } = useTranslation()
```

| Property | Type | Description |
|:---------|:-----|:------------|
| `engine` | `'google' \| 'libre'` | Active translation engine |
| `setEngine(engine)` | `function` | Switch translation engines |
| `translate(text, targetLang)` | `async function` | Translate text using active engine |
| `isLoading` | `boolean` | Whether a translation request is in progress |

---

## 🔌 API Client Layer

The API client is configured in `src/api/client.js`:

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' }
})

export default api
```

**Auth interceptor**: The `AuthContext` attaches `Authorization: Bearer <token>` to outgoing requests automatically for authenticated endpoints.

---

## 🗺 Routing Architecture

FlagForge uses React Router v6 with **protected route guards**.

### Route Map

| Path | Component | Auth Required | Description |
|:-----|:----------|:-------------|:------------|
| `/` | `LandingPage` | ❌ | Public landing page with auth forms |
| `/auth/callback/:provider` | `OAuthCallback` | ❌ | OAuth redirect handler |
| `/dashboard` | `Dashboard` | ✅ | Telemetry metrics dashboard |
| `/flags` | `Flags` | ✅ | Flag catalog and management |
| `/flags/:key` | `FlagDetail` | ✅ | Flag editor with targeting rules |
| `/teams` | `Teams` | ✅ | User group management |
| `/environments` | `Environments` | ✅ | Environment CRUD |
| `/audit-log` | `AuditLog` | ✅ | Compliance audit log |
| `/settings` | `Settings` | ✅ | Translation engine settings |
| `*` | Redirect to `/` | — | Catch-all redirect |

### Authentication Guard

The `ProtectedRoute` component wraps all authenticated routes:
1. Shows a loading spinner while checking stored JWT.
2. Redirects to `/` if no valid token exists.
3. Renders the protected content wrapped in the `Layout` shell.

### Layout Shell

Protected routes are wrapped in `<Layout>`, which provides:
- **Sidebar**: Collapsible navigation menu with active state highlighting.
- **Navbar**: Top bar with environment switcher, user avatar, and logout.
- **Content Area**: Renders the active page via `<Outlet>`.

---

## 🎨 CSS Design System

The global stylesheet (`src/index.css`, ~50KB) implements a comprehensive custom design system.

### CSS Variables (Theme Tokens)

```css
:root {
  --primary: #ff5722;           /* Brand orange */
  --bg-main: #0d1117;           /* Dark background */
  --bg-card: #161b22;           /* Card surface */
  --bg-sidebar: #0d1117;        /* Sidebar background */
  --text-primary: #e6edf3;      /* Primary text */
  --text-muted: #8b949e;        /* Secondary text */
  --border-color: #30363d;      /* Border and dividers */
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  /* ... 30+ additional tokens */
}
```

### Design Features

- **Dark-first theme**: Designed primarily for dark mode with carefully tuned contrast ratios.
- **Glassmorphism**: Semi-transparent card backgrounds with `backdrop-filter: blur()`.
- **Micro-animations**: Hover effects, transitions, and loading spinners throughout.
- **Responsive grid**: CSS Grid and Flexbox layouts that adapt across breakpoints.
- **Custom scrollbars**: Styled thin scrollbars matching the dark theme.
- **Interactive elements**: All buttons, inputs, and toggles have hover, focus, and active states.

---

## 🔑 Key Frontend Patterns

### Environment-Aware Data Fetching

Most pages accept the current environment from the `EnvironmentSwitcher` and pass it as a query parameter:

```javascript
// Example: Fetching flags for the selected environment
const [environment, setEnvironment] = useState('development')
const { data: flags } = await api.get(`/flags?environment=${environment}`)
```

### Optimistic Updates

Toggle switches (flag enable/disable) apply the UI change immediately, then sync with the backend:

1. Update local state optimistically.
2. Fire `PUT /flags/{key}?environment=...` with `{ is_enabled: true/false }`.
3. Revert state if the API call fails.

### Modal Pattern

The `CreateFlagModal` uses a controlled modal pattern:

```jsx
const [showModal, setShowModal] = useState(false)
// Modal opens with setShowModal(true)
// Modal closes on submit success or cancel
// Parent re-fetches flag list after modal closes
```

