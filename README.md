# Faculty Dashboard

The dashboard can be opened directly as a local file. It uses `faculty-data.js` for the Faculty page when `file://` blocks JSON fetches, and falls back to `faculty.json` when served over HTTP.

The dashboard has three page buttons:

- `Faculty` shows the clickable faculty tiles.
- `Graduate Students` shows names from `graduate-students-data.js`. Add strings or `{ name, program }` objects to that file.
- `Building Map` shows Floor 1, Floor 2, and Floor 3 selectors. Add the corresponding images at `assets/building-map-floor-1.png`, `assets/building-map-floor-2.png`, and `assets/building-map-floor-3.png`.

It can also be run through a web server; this is how it should be hosted on GitHub Pages:

```bash
cd /Users/dallindunn/Documents/InfoDisplay/faculty-dashboard
python3 -m http.server
```

Then visit `http://localhost:8000`.

The updater keeps the dashboard JSON and local-file data script synchronized with the main `faculty.json` file:

```bash
cd /Users/dallindunn/Documents/InfoDisplay
node update-office-hours.js
```

## Refresh workflow

Run these commands from `/Users/dallindunn/Documents/InfoDisplay`:

```bash
node create-office-hours-template.js
# Fill in officeHourTemplate.csv.
node update-office-hours.js
node scrape-faculty-websites.js
```

The source pages are `facAdjunct.html`, `facEmeritus.html`, `facPermanent.html`, and `facVisiting.html`. The office-hours template exports the complete faculty record, including picture link, website link, job title, email, office room, research, appointment note, and eight `Class/Room`/`Day`/`Time` entry groups. The rows currently present in `officeHourTemplate.csv` define the active roster; deleting a name row removes that person from both JSON outputs when the updater runs. The website scraper creates the local popup pages in `faculty-dashboard/Fac_Website/` and updates the profile manifest.

## Generate local faculty profiles

The supplied `testingFacPageOpen.css` stylesheet and the `.EmployeePage-contentWrapper` from each website can be saved locally with:

```bash
node scrape-faculty-websites.js
```

This creates `Fac_Website/`, one HTML file per faculty member, a copied `faculty-profile.css`, and `profile-manifest.js`. The dashboard iframe uses the local profile files when they are available.

Generated profile pages convert the source page's links into plain displayed text, so nothing inside the iframe navigates away from the self-contained local profile. If a local profile is unavailable, the iframe stays blank rather than loading the remote website.

The dashboard is configured as a touch-first kiosk interface: the dashboard and faculty profiles use swipe scrolling with hidden scrollbars, controls have larger touch targets, and the webpage cursor remains visible. Firefox's browser chrome and operating-system pointer cannot be hidden by webpage CSS; use F11 for browser fullscreen.

To use a different copy of the profile stylesheet:

```bash
FACULTY_PROFILE_CSS=/path/to/testingFacPageOpen.css node scrape-faculty-websites.js
```
