# HBT_TRKR · habits that glow

A visually stunning 3D habit tracker with an interactive heatmap that rotates, rolls, and transforms as you scroll. Built with React, React Three Fiber, and three.js.

## Features

- **3D Glass Heatmap:** Each day in the last 26 weeks is a tile. Taller tiles and warmer colors show days when you completed more habits.
- **Scroll choreography:** The heatmap rotates flat while you view it, then rolls into a ring as you scroll, finally sinking into the background while the week page rotates up.
- **Week board:** Mark habits directly on a 7-day grid. Set weekly goals for each habit, track streaks, and add notes for the week.
- **Six materials:** Glass, Frosted, Holo, Chrome, Ceramic, Neon—each with different optical properties.
- **Five heat palettes:** Ember, Aurora, Violet, Glacier, Mono—plus a custom color picker.
- **Inspect mode:** Freeze the page scroll and orbit the heatmap in 3D. Zoom and rotate freely.
- **Local storage:** All your habits and history are saved in your browser. No signup, no sync.
- **Offline-capable:** Once loaded, the site works without an internet connection.
- **Fallback image:** If WebGL isn't available or crashes, a static isometric poster shows instead.
- **Adaptive performance:** Resolution scales down on slow devices, restores when frame rate recovers.

## Getting started

### Requirements

- **Node.js 18 or newer.** Download from [nodejs.org](https://nodejs.org).
- A modern browser: Chrome, Edge, Firefox, or Safari (all with WebGL support).

### Installation

1. **Extract the zip file** into a folder, for example `Desktop/kiln`.

2. **Open a terminal** in that folder.
   - **Windows:** Open File Explorer, navigate into the folder, click the address bar, type `cmd`, press Enter.
   - **macOS/Linux:** Right-click the folder, select "Open in Terminal" (or drag the folder onto Terminal.app).

3. **Fix PowerShell script policy** (Windows only, first time):
   ```
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
   Type `Y` and press Enter if prompted.

4. **Install dependencies:**
   ```
   npm install
   ```

5. **Start the dev server:**
   ```
   npm run dev
   ```

6. **Open the URL** that prints in your terminal, usually `http://localhost:5173`.

The site will reload automatically when you edit files.

## How to use

### Marking habits

1. Click **Heatmap** in the top nav to go to the flat view.
2. Click any habit button under the map to toggle it for today (or the selected day).
3. Click any tile on the 3D map to jump to that day; its buttons appear below.

### Managing habits

1. Click **This week** in the top nav.
2. Click the day cells in the week board to toggle habits directly.
3. Use the **+/−** buttons on each habit row to raise or lower its weekly goal (1–7 per week).
4. Click the **×** button to delete a habit (confirm the second click).
5. Fill in the **Add habit** form at the bottom to create a new one.
6. Type a **Focus for this week** to jot down an intention.

### 3D view controls

- **Drag to rotate** the map (mouse).
- **Scroll to zoom** (mouse wheel).
- **Pinch to zoom** (trackpad or touch).
- Click **Studio** (top right) → **Inspect in 3D** to unlock full 3D mode with zoom buttons.
- Press **Esc** to exit inspect mode.

### Styling the heatmap

Click **Studio** in the top right to open the panel:

- **Material:** Choose a finish (Glass, Frosted, Holo, Chrome, Ceramic, Neon).
- **Heat color:** Pick one of five palettes or click the swatch to choose any color.
- **View:** Toggle **Idle motion** (slow auto-rotation), adjust **Rolling centre** (which week the heatmap curls around), or zoom.

### Data management

In the **This week** page, at the bottom under "Recent":

- **Load demo history:** Populate the tracker with 26 weeks of believable habit data.
- **Clear history:** Erase all logs and events (confirm the second click).

All changes are saved to your browser's local storage automatically. There's no cloud sync or export.

## Building for production

To create an optimized build:

```
npm run build
npm run preview
```

This runs a production-like server on `http://localhost:4173` so you can test the build locally.

The build script also checks that all assets fit within the 5 MB budget. If they don't, the build fails and tells you which files are too large.

## Project structure

```
kiln/
├── public/                 # Static assets
│   ├── hdri/              # Studio HDRI (loaded on-demand)
│   ├── models/            # GLB heatmap tile
│   ├── textures/          # Normal maps and other textures
│   └── fallback/          # Static SVG poster (WebGL fallback)
├── src/
│   ├── lib/               # Pure logic (no React)
│   │   ├── dates.js       # Date/time helpers and formatting
│   │   ├── habits.js      # Habit store, grid builder, streaks
│   │   ├── story.js       # Scroll story (page rotation choreography)
│   │   ├── looks.js       # Material and palette definitions
│   │   └── util.js        # Math, color, WebGL detection
│   ├── scene/             # React Three Fiber components
│   │   ├── HeatmapStage.jsx       # Canvas wrapper, error boundary
│   │   ├── HeatmapScene.jsx       # Lights, layout, camera rig
│   │   ├── Heatmap.jsx            # Instanced tiles, curl math, picking
│   │   └── heatMaterial.js        # Shader patches for heat glow
│   ├── ui/                # React UI components
│   │   ├── Hero.jsx       # First page with day marking pills
│   │   ├── WeekPage.jsx   # Habit board, weekly goals, activity log
│   │   └── StudioPanel.jsx # Material/color/view settings
│   ├── App.jsx            # Main shell, state, scroll wiring
│   ├── main.jsx           # Entry point
│   └── styles.css         # All styling (no tailwind, no deps)
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
└── vite.config.js         # Vite configuration
```

## Customizing

### Change the heatmap model

Replace `public/models/habit-tile.glb` with your own GLB file. The first mesh found in the file will be resized to fit the day grid. It should be a single closed shape; normals are computed if missing.

To export from Blender:
1. Select your object.
2. File → Export as → glTF 2.0 (.glb/.gltf).
3. Check "Format: glTF Binary (.glb)".
4. Check "Include: Normals".
5. Export, and replace `habit-tile.glb`.

### Change the HDRI

Replace `public/hdri/studio-soft.hdr` with your own Radiance HDR file (or generate one with the Python script in the source). The HDRI is loaded on-demand after the page is interactive.

### Adjust 3D framing

In `src/scene/HeatmapScene.jsx`, edit the `POSES` object:

- `hero.x, hero.y`: Camera offset while flat.
- `hero.rx, hero.ry0, hero.ry1`: Camera tilt and initial/hover yaw.
- `roll.x, roll.y, roll.rx, roll.ry`: Camera during the roll sequence.
- `back.x, back.y, back.z, back.rx, back.ry, back.s`: Camera in the background, and the scale of the rolled map.
- `shadowY`: Where the soft shadow sits under the flat map.

Adjust these values and refresh the page to see the changes in real time.

### Add more materials

In `src/lib/looks.js`, add an object to the `MATERIALS` array:

```javascript
{
  key: 'myName',
  label: 'Display Name',
  glow: 1.0,
  tint: 1,
  normalMap: null,  // or '/textures/my-normal.png'
  props: {
    transmission: 1,
    roughness: 0.1,
    metalness: 0,
    // ... other MeshPhysicalMaterial properties
  }
}
```

Add a swatch style in `src/styles.css` under `.sw-myName`.

### Add more palettes

In `src/lib/looks.js`, add an object to the `PALETTES` array:

```javascript
{
  key: 'myPalette',
  label: 'Palette Name',
  cold: '#1a1a2e',
  mid: '#16c79a',
  hot: '#ffd89a'
}
```

The colors should go from a dark cold tone, through a mid tone (the most visible), to a bright hot tone.

## Performance

- **First paint:** ~300 ms (no 3D assets block the initial render).
- **Time to interactive:** ~800 ms (habit UI is ready before the 3D scene loads).
- **Asset budget:** All files must fit in 5 MB. The build fails if they exceed this.
- **Motion:** Reduced motion (`prefers-reduced-motion: reduce`) is respected; animations become instant.

The 3D scene adapts its resolution at runtime:
- If frame rate drops below 50 fps for three frames, it halves the DPR.
- If frame rate recovers above 55 fps for three frames, it restores the DPR.

## Troubleshooting

**"npm is not recognized"**
- Make sure Node.js is installed. Download from [nodejs.org](https://nodejs.org) and restart your terminal.

**"Cannot find module 'three'"**
- Run `npm install` again. If it fails, delete `node_modules` and `package-lock.json`, then run `npm install`.

**Blank screen or "3D stage failed"**
- Check the browser console (F12 → Console tab) for errors.
- Try adding `?nowebgl` to the URL to see the static fallback.
- Try a different browser.

**Habits don't save**
- Check that localStorage is enabled in your browser settings.
- If using private/incognito mode, data is cleared when you close the tab.

**Slow performance**
- The resolution will adapt, but you can also reduce effects: toggle **Idle motion** off in Studio, or use a simpler material like Ceramic.

**Very slow on mobile**
- Use a recent version of Chrome or Safari. Older browsers have slower WebGL.
- Try `?nowebgl` to use the static image instead.

## Browser support

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 15+

Older browsers will show the static fallback image instead of the 3D heatmap.

## Keyboard shortcuts

- **Esc** — Exit inspect mode.
- **Esc** — Close the Studio panel (if not in inspect mode).

## File size

| File | Size |
|------|------|
| habit-tile.glb | 16.9 KB |
| studio-soft.hdr | 44.2 KB |
| frost-normal.png | 82.7 KB |
| heatmap-poster.svg | 57.6 KB |
| **Total assets** | **~201 KB** |

The JavaScript and CSS are bundled by Vite and optimized. Code-split chunks load on-demand (three.js is only fetched when the 3D view is needed).

## License

This project is yours to use, modify, and share freely. No attribution required.

## Credits

Built with:
- [React](https://react.dev)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [three.js](https://threejs.org)
- [Drei](https://github.com/pmndrs/drei)
- [Vite](https://vitejs.dev)

Font: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (UI) and [Fraunces](https://fonts.google.com/specimen/Fraunces) (display).

---

**Questions or feedback?** Check the console (F12) for errors, or review the code in `src/`. Every component is documented.

Happy tracking! 🔥
