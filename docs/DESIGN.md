# DocSage Design System: "The Reading Room"

"The Reading Room" design system creates a calm, editorial, distraction-free environment for reading and synthesizing complex technical documents. It bridges tactile paper qualities with modern AI telemetry.

---

## 1. Palette & Color Tokens

All colors are defined as CSS custom properties in `apps/web/src/tokens.css` with dark mode overrides under `.dark`.

| Token Name              | Light Value               | Dark Value                  | Semantic Purpose                         |
| :---------------------- | :------------------------ | :-------------------------- | :--------------------------------------- |
| `--bg-paper`            | `#F6F1E7`                 | `#121110`                   | Base background: warm tactile book paper |
| `--bg-surface`          | `#FFFFFF`                 | `#1A1917`                   | Card and component surfaces              |
| `--bg-surface-raised`   | `#EDE7DA`                 | `#23211E`                   | Dropdowns, modals, elevated trays        |
| `--text-ink`            | `#1B1A17`                 | `#EDEAE3`                   | High-contrast body typography            |
| `--text-muted`          | `#6B665C`                 | `#9E998E`                   | Captions, metadata, secondary copy       |
| `--accent-forest`       | `#1F5C4B`                 | `#2A7A64`                   | Primary brand action, active states      |
| `--accent-forest-hover` | `#174639`                 | `#339178`                   | Interactive button hover                 |
| `--accent-yellow`       | `#F2D55C`                 | `#D4B83E`                   | Highlighter citation markers             |
| `--accent-yellow-light` | `rgba(242, 213, 92, 0.2)` | `rgba(212, 184, 62, 0.2)`   | In-text citation backgrounds             |
| `--accent-terracotta`   | `#C84B31`                 | `#E05D42`                   | Destructive actions, error alerts        |
| `--border-subtle`       | `rgba(27, 26, 23, 0.10)`  | `rgba(237, 234, 227, 0.12)` | Container borders, table dividers        |
| `--border-strong`       | `rgba(27, 26, 23, 0.24)`  | `rgba(237, 234, 227, 0.26)` | Focus rings, active tabs                 |

---

## 2. Typography Hierarchy

DocSage pairs an editorial display serif with a humanist grotesque sans-serif for balanced scannability and long-form comprehension.

### Typefaces

- **Serif Display:** `Fraunces` (`@fontsource/fraunces`, weights 400, 600, 700)
- **Sans Body/UI:** `Instrument Sans` (`@fontsource/instrument-sans`, weights 400, 500, 600)
- **Code/Telemetry:** `ui-monospace, SFMono-Regular, Menlo, monospace`

### Scale

- **Display 1 (Hero Title):** `clamp(2.5rem, 5vw, 4.25rem)` / Line height `1.1` / Font `Fraunces`
- **Heading 1 (`h1`):** `2rem` (32px) / Line height `1.2` / Font `Fraunces`
- **Heading 2 (`h2`):** `1.5rem` (24px) / Line height `1.3` / Font `Fraunces`
- **Heading 3 (`h3`):** `1.125rem` (18px) / Line height `1.4` / Font `Instrument Sans` (600)
- **Body Large:** `1.125rem` (18px) / Line height `1.6` / Font `Instrument Sans` (400)
- **Body Regular:** `0.9375rem` (15px) / Line height `1.5` / Font `Instrument Sans` (400)
- **Caption / Metadata:** `0.8125rem` (13px) / Line height `1.4` / Font `Instrument Sans` (500)
- **Monospace Code:** `0.8125rem` (13px) / Line height `1.5` / Font `ui-monospace`

---

## 3. Spacing & Elevation

### Spacing Scale

- `4px` (`--space-1`): Internal chip padding, tight borders
- `8px` (`--space-2`): Icon-to-text spacing, button gap
- `12px` (`--space-3`): Input internal padding, dropdown item padding
- `16px` (`--space-4`): Card internal padding, table cell padding
- `24px` (`--space-6`): Section gutter, grid gap
- `32px` (`--space-8`): Large container padding
- `48px` (`--space-12`): Section separator vertical margin
- `64px` (`--space-16`): Landing hero top/bottom vertical margin

### Elevation & Shadows

- **Card Shadow:** `0 1px 3px rgba(27, 26, 23, 0.05), 0 1px 2px rgba(27, 26, 23, 0.03)`
- **Drawer / Modal Shadow:** `-4px 0 24px rgba(27, 26, 23, 0.12)`
- **Hover Lift:** `transform: translateY(-1px); box-shadow: 0 4px 12px rgba(27, 26, 23, 0.08)`

---

## 4. Components & Interaction Patterns

### 1. Citation Chips & Source Drawer

- **Inline Chips (`[1]`, `[2]`):** Yellow highlight pill (`--accent-yellow-light`) with solid border.
- **Drawer Trigger:** Clicking a chip smoothly opens the right-hand Source Drawer, scrolling directly to the source chunk with page numbers, document title, and semantic relevance badge.

### 2. Status Chips

- **Ready:** Green forest tone (`rgba(31, 92, 75, 0.1)` bg, `#1F5C4B` text).
- **Processing:** Yellow marker tone (`rgba(242, 213, 92, 0.2)` bg, `#8A7314` text) with animated pulse.
- **Failed:** Terracotta alert tone (`rgba(200, 75, 49, 0.1)` bg, `#C84B31` text).

### 3. File Upload Tray

- Dropzone styled as an archival desk tray with dashed ink border, dragover highlights, size validation chips (50MB maximum), and instant SHA-256 deduplication feedback.

### 4. Accessibility & Navigation

- Skip links, ARIA labels on all modal and drawer triggers, high-contrast focus rings (`outline: 2px solid var(--accent-forest)`).
- Full keyboard navigation: Escape dismisses drawers, Tab cycles focus predictably.
