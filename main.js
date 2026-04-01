let workspace, pyodide, ctx, gameStarted = false;
let currentLevel = null;
let LEVELS = []; // Will be loaded from files
let TUTORIALS = []; // Will be loaded from files

// Default scenario config (all values in SI units)
const DEFAULT_SCENARIO = {
  x: 0,              // horizontal position (m)
  y: 90,             // altitude (m)
  vx: 0,             // horizontal velocity (m/s)
  vy: 0,             // vertical velocity (m/s)
  angle: 0,          // orientation (radians, 0 = up)
  angularVelocity: 0,// rotational speed (rad/s)
  fuel: 0.5          // fuel mass (kg)
};

// Helper function to create a level with defaults
function createLevel(levelData) {
  return {
    id: levelData.id,
    name: levelData.name,
    description: levelData.description,
    scenario: { ...DEFAULT_SCENARIO, ...levelData.scenario },
    target: levelData.target || null,
    mode: levelData.mode || 'both'  // 'manual', 'code', or 'both'
  };
}

// Load all levels from JSON files
async function loadLevels() {
  try {
    // Load the manifest file
    const manifestResponse = await fetch('levels/levels.json');
    const manifest = await manifestResponse.json();

    // Load each level file
    const levelPromises = manifest.levels.map(async (filename) => {
      const response = await fetch(`levels/${filename}`);
      const levelData = await response.json();
      return createLevel(levelData);
    });

    LEVELS = await Promise.all(levelPromises);
    console.log(`Loaded ${LEVELS.length} levels`);
    return LEVELS;
  } catch (err) {
    console.error("Error loading levels:", err);
    addToConsole(`ERROR loading levels: ${err.message}`);
    return [];
  }
}

// Load all tutorials from JSON files
async function loadTutorials() {
  try {
    // Load the manifest file
    const manifestResponse = await fetch('tutorials/tutorials.json');
    const manifest = await manifestResponse.json();

    // Load each tutorial file (metadata + HTML content)
    const tutorialPromises = manifest.tutorials.map(async (filename) => {
      const response = await fetch(`tutorials/${filename}`);
      const tutorialData = await response.json();

      // Load the HTML content from separate file
      const contentResponse = await fetch(`tutorials/${tutorialData.contentFile}`);
      const htmlContent = await contentResponse.text();

      // Combine metadata with content
      return {
        ...tutorialData,
        content: htmlContent
      };
    });

    TUTORIALS = await Promise.all(tutorialPromises);
    console.log(`Loaded ${TUTORIALS.length} tutorials`);
    return TUTORIALS;
  } catch (err) {
    console.error("Error loading tutorials:", err);
    return [];
  }
}

// Console output handling
function addToConsole(text) {
  const consoleContent = document.getElementById('consoleContent');
  const line = document.createElement('div');
  line.textContent = text;
  consoleContent.appendChild(line);
  // Auto-scroll to bottom
  consoleContent.scrollTop = consoleContent.scrollHeight;
}

// main JS entry
async function init() {
  // Load levels and tutorials
  await loadLevels();
  await loadTutorials();

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: `
      <xml>
        <category name="Control" colour="230">
          <block type="set_throttle">
            <value name="VALUE">
              <shadow type="math_number">
                <field name="NUM">0.5</field>
              </shadow>
            </value>
          </block>
          <block type="set_rcs">
            <value name="VALUE">
              <shadow type="math_number">
                <field name="NUM">0</field>
              </shadow>
            </value>
          </block>
        </category>
        <category name="Sensors" colour="120">
          <block type="get_throttle"></block>
          <block type="get_rcs"></block>
          <block type="get_altitude"></block>
          <block type="get_velocity"></block>
          <block type="get_horizontal_position"></block>
          <block type="get_horizontal_velocity"></block>
          <block type="get_speed"></block>
          <block type="get_angle"></block>
          <block type="get_angular_velocity"></block>
        </category>
        <category name="Constants" colour="65">
          <block type="const_vehicle_mass"></block>
          <block type="const_max_thrust"></block>
          <block type="const_rcs_torque"></block>
          <block type="const_gravity"></block>
          <block type="const_fuel_rate"></block>
          <block type="const_moment_inertia"></block>
        </category>
        <category name="Variables" colour="330" custom="VARIABLE"></category>
        <category name="Functions" colour="290" custom="PROCEDURE"></category>
        <category name="Time" colour="190">
          <block type="wait_seconds">
            <field name="SECONDS">1</field>
          </block>
          <block type="is_first_timestep"></block>
          <block type="get_time"></block>
        </category>
        <category name="Logic" colour="210">
          <block type="controls_if"></block>
          <block type="controls_repeat_ext">
            <value name="TIMES">
              <shadow type="math_number">
                <field name="NUM">10</field>
              </shadow>
            </value>
          </block>
          <block type="controls_whileUntil"></block>
          <block type="logic_compare">
            <field name="OP">LT</field>
          </block>
          <block type="logic_operation"></block>
        </category>
        <category name="Math" colour="230">
          <block type="math_number">
            <field name="NUM">0</field>
          </block>
          <block type="math_arithmetic">
            <field name="OP">ADD</field>
          </block>
          <block type="math_trig">
            <field name="OP">SIN</field>
          </block>
          <block type="math_trig_inverse">
            <field name="OP">ASIN</field>
          </block>
          <block type="math_atan2"></block>
          <block type="math_radians"></block>
          <block type="math_degrees"></block>
          <block type="math_abs"></block>
          <block type="math_square"></block>
          <block type="math_sqrt"></block>
          <block type="math_round"></block>
          <block type="angle_error"></block>
          <block type="math_pi"></block>
        </category>
        <category name="Text" colour="160">
          <block type="text_print">
            <value name="TEXT">
              <shadow type="text">
                <field name="TEXT">message</field>
              </shadow>
            </value>
          </block>
        </category>
      </xml>
    `,
    sounds: false,  // Disable sounds to avoid CORS issues with cross-origin isolation
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2
    }
  });

  // Populate level select menu
  const levelList = document.getElementById('levelList');
  LEVELS.forEach(level => {
    const levelButton = document.createElement('div');
    levelButton.className = 'levelButton';
    levelButton.innerHTML = `
      <div class="levelName">${level.name}</div>
      <div class="levelDescription">${level.description}</div>
    `;
    levelButton.addEventListener('click', () => {
      currentLevel = level;
      document.getElementById('levelSelectOverlay').style.display = 'none';
      addToConsole(`Level selected: ${level.name}`);
    });
    levelList.appendChild(levelButton);
  });

  const canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  // start draw loop at 60 FPS
  requestAnimationFrame(update);

  // load Pyodide and our Python physics from separate file
  pyodide = await loadPyodide();

  // Redirect Python stdout to our console
  pyodide.setStdout({
    batched: (text) => {
      addToConsole(text);
    }
  });

  const physicsCode = await fetch('physics.py?v=16').then(r => r.text());
  await pyodide.runPythonAsync(physicsCode);

  console.log("Pyodide loaded and ready");
  addToConsole("Pyodide ready. Select a level to begin!");
  addToConsole("Tip: Press 'M' during simulation for manual control!");
  addToConsole("Controls: W/S = throttle up/down, A/D = rotate");

  // Clear console button handler
  document.getElementById("clearConsole").addEventListener("click", () => {
    document.getElementById('consoleContent').innerHTML = '';
    addToConsole("Console cleared.");
  });

  // Time warp button handlers
  function setTimeWarp(factor, buttonId) {
    if (pyodide && gameStarted) {
      pyodide.runPythonAsync(`set_time_warp(${factor})`).catch(err => console.error(err));
    }
    // Update button active states
    document.querySelectorAll('.warpButton').forEach(btn => btn.classList.remove('active'));
    document.getElementById(buttonId).classList.add('active');
  }

  document.getElementById("warp1x").addEventListener("click", () => setTimeWarp(1.0, 'warp1x'));
  document.getElementById("warp2x").addEventListener("click", () => setTimeWarp(2.0, 'warp2x'));
  document.getElementById("warp5x").addEventListener("click", () => setTimeWarp(5.0, 'warp5x'));
  document.getElementById("warp10x").addEventListener("click", () => setTimeWarp(10.0, 'warp10x'));

  // Success overlay handler
  document.getElementById("successOkButton").addEventListener("click", () => {
    document.getElementById('successOverlay').style.display = 'none';
  });

  // Failure overlay handlers
  document.getElementById("tryAgainButton").addEventListener("click", () => {
    document.getElementById('failureOverlay').style.display = 'none';
    document.getElementById('runButton').click();
  });

  document.getElementById("failureMenuButton").addEventListener("click", () => {
    document.getElementById('failureOverlay').style.display = 'none';
    document.getElementById('levelSelectOverlay').style.display = 'flex';
  });

  // Menu button handler
  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById('levelSelectOverlay').style.display = 'flex';
    addToConsole("Returning to level select menu...");
  });

  // Tutorial button handler
  document.getElementById("tutorialButton").addEventListener("click", () => {
    document.getElementById('tutorialOverlay').style.display = 'flex';
  });

  // Close tutorial overlay
  document.getElementById("closeTutorial").addEventListener("click", () => {
    document.getElementById('tutorialOverlay').style.display = 'none';
  });

  // Close tutorial viewer
  document.getElementById("closeTutorialViewer").addEventListener("click", () => {
    document.getElementById('tutorialViewer').style.display = 'none';
  });

  // Back to tutorials button
  document.getElementById("backToTutorials").addEventListener("click", () => {
    document.getElementById('tutorialViewer').style.display = 'none';
    document.getElementById('tutorialOverlay').style.display = 'flex';
  });

  // Populate tutorial list
  const tutorialList = document.getElementById('tutorialList');
  TUTORIALS.forEach(tutorial => {
    const tutorialItem = document.createElement('div');
    tutorialItem.className = 'tutorialItem';
    tutorialItem.innerHTML = `
      <div class="tutorialItemTitle">${tutorial.title}</div>
      <div class="tutorialItemDescription">${tutorial.description}</div>
    `;
    tutorialItem.addEventListener('click', () => {
      // Show tutorial content
      document.getElementById('tutorialTitle').textContent = tutorial.title;
      document.getElementById('tutorialContent').innerHTML = tutorial.content;
      document.getElementById('tutorialOverlay').style.display = 'none';
      document.getElementById('tutorialViewer').style.display = 'flex';
    });
    tutorialList.appendChild(tutorialItem);
  });

  // Save blocks to JSON file
  document.getElementById("saveButton").addEventListener("click", () => {
    const filename = prompt("Save as:", "lander_blocks");
    if (!filename) return; // User cancelled

    const state = Blockly.serialization.workspaces.save(workspace);
    const json = JSON.stringify(state, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : filename + '.json';
    a.click();
    URL.revokeObjectURL(url);

    addToConsole(`Blocks saved to ${a.download}!`);
  });

  // Load blocks from JSON file
  document.getElementById("loadButton").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        Blockly.serialization.workspaces.load(state, workspace);
        addToConsole("Blocks loaded from file!");
      } catch (err) {
        addToConsole(`ERROR loading file: ${err.message}`);
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be loaded again
    event.target.value = '';
  });

  // Keyboard controls for manual flight
  let manualControlEnabled = false;
  const keysPressed = {};
  let currentThrottle = 0.0;

  // Track key states
  window.addEventListener("keydown", (e) => {
    // Toggle manual control with M key (works anytime after pyodide loads)
    if ((e.key === "m" || e.key === "M") && pyodide) {
      const mode = currentLevel?.mode || 'both';
      if (mode === 'manual') { addToConsole("Manual control is locked ON for this level."); return; }
      if (mode === 'code')   { addToConsole("Manual control is disabled for this level."); return; }
      manualControlEnabled = !manualControlEnabled;
      const status = manualControlEnabled ? "ENABLED" : "DISABLED";
      addToConsole(`Manual control ${status} (W/S: throttle, A/D: rotate)`);
      if (!manualControlEnabled) {
        currentThrottle = 0.0;
        if (gameStarted) pyodide.runPythonAsync('set_throttle(0.0)').catch(err => console.error(err));
      }
      return;
    }

    if (!manualControlEnabled || !gameStarted || !pyodide) return;

    // Prevent default for control keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "s", "S", "a", "A", "d", "D"].includes(e.key)) {
      e.preventDefault();
    }

    keysPressed[e.key] = true;
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.key] = false;
  });

  // Process controls continuously
  setInterval(() => {
    if (!gameStarted || !pyodide || !manualControlEnabled) return;

    const THROTTLE_CHANGE_RATE = 0.05;  // Throttle change per frame

    // W or Up Arrow: Increase throttle
    if (keysPressed["w"] || keysPressed["W"] || keysPressed["ArrowUp"]) {
      currentThrottle = Math.min(1.0, currentThrottle + THROTTLE_CHANGE_RATE);
      pyodide.runPythonAsync(`set_throttle(${currentThrottle})`).catch(err => console.error(err));
    }

    // S or Down Arrow: Decrease throttle
    if (keysPressed["s"] || keysPressed["S"] || keysPressed["ArrowDown"]) {
      currentThrottle = Math.max(0.0, currentThrottle - THROTTLE_CHANGE_RATE);
      pyodide.runPythonAsync(`set_throttle(${currentThrottle})`).catch(err => console.error(err));
    }

    // A or Left Arrow: Rotate CW (positive RCS)
    // D or Right Arrow: Rotate CCW (negative RCS)
    let rcsValue = 0;
    if (keysPressed["a"] || keysPressed["A"] || keysPressed["ArrowLeft"]) {
      rcsValue = 1.0;  // Clockwise
    } else if (keysPressed["d"] || keysPressed["D"] || keysPressed["ArrowRight"]) {
      rcsValue = -1.0;  // Counterclockwise
    }
    pyodide.runPythonAsync(`set_rcs(${rcsValue})`).catch(err => console.error(err));
  }, 16);  // Run at ~60 FPS

  // run button handler
  document.getElementById("runButton").addEventListener("click", async () => {
    if (!currentLevel) {
      addToConsole("Please select a level first!");
      document.getElementById('levelSelectOverlay').style.display = 'flex';
      return;
    }

    console.log("Run button clicked");
    addToConsole("--- Starting simulation ---");
    addToConsole(`Level: ${currentLevel.name}`);

    // Reset crash timer and success state
    gameStarted = false;  // Stop render loop from querying stale Python state during reset
    crashTime = null;
    previousLandedState = false;
    document.getElementById('successOverlay').style.display = 'none';
    document.getElementById('failureOverlay').style.display = 'none';

    // Apply level mode
    const levelMode = currentLevel.mode || 'both';
    currentThrottle = 0.0;
    if (levelMode === 'manual') {
      manualControlEnabled = true;
      addToConsole("Manual control mode — W/S: throttle, A/D: rotate");
    } else {
      manualControlEnabled = false;
      if (levelMode === 'code') addToConsole("Code-only mode — manual control disabled");
      else addToConsole("Press 'M' to toggle manual control");
    }

    // In manual mode skip Blockly entirely — use a no-op control function
    if (levelMode === 'manual') {
      try {
        await pyodide.runPythonAsync(`
import asyncio
async def user_control():
    pass
set_control_function(user_control)
`);
        const s = currentLevel.scenario;
        await pyodide.runPythonAsync(
          `load_scenario(${s.x}, ${s.y}, ${s.vx}, ${s.vy}, ${s.angle}, ${s.angularVelocity}, ${s.fuel})`
        );
        const t = currentLevel.target;
        await pyodide.runPythonAsync(t != null ? `set_target(${t.x})` : `clear_target()`);
        gameStarted = true;
        addToConsole("Simulation started!");
        addToConsole(`Starting fuel: ${s.fuel.toFixed(2)} kg`);
      } catch (err) {
        addToConsole(`ERROR: ${err.message}`);
      }
      return;
    }

    const code = Blockly.Python.workspaceToCode(workspace);

    // Get all variables from the workspace
    const variables = workspace.getAllVariables();
    const varNames = variables.map(v => v.name);

    // Create variable initialization code (at module level)
    const varInit = varNames.length > 0
      ? varNames.map(name => `${name} = 0`).join('\n') + '\n'
      : '';

    // Create global declarations for inside the function
    const globalDecl = varNames.length > 0
      ? '    global ' + varNames.join(', ') + '\n'
      : '';

    // Remove Blockly's automatic variable initialization (e.g., "count = None")
    // These reset variables every timestep, which we don't want
    let userCode = code;
    if (varNames.length > 0) {
      const lines = userCode.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        // Remove lines that look like "variableName = None"
        for (const varName of varNames) {
          if (trimmed === `${varName} = None`) {
            return false;
          }
        }
        return true;
      });
      userCode = filteredLines.join('\n');
    }

    // POST-PROCESS: Remove Blockly's degree conversions to force radians
    userCode = userCode.replace(/\s*\/\s*math\.pi\s*\*\s*180/g, '');  // Remove "/ math.pi * 180"
    userCode = userCode.replace(/\s*\*\s*180\s*\/\s*math\.pi/g, '');  // Remove "* 180 / math.pi"
    userCode = userCode.replace(/\s*\*\s*math\.pi\s*\/\s*180/g, '');  // Remove "* math.pi / 180"
    userCode = userCode.replace(/\s*\/\s*180\s*\*\s*math\.pi/g, '');  // Remove "/ 180 * math.pi"

    // If there's no code, add a pass statement to avoid IndentationError
    userCode = userCode.trim() ? userCode : 'pass';

    // Wrap user code in an async control function that runs every timestep
    const wrappedCode = `
import asyncio

# Import physics constants for user code
from __main__ import GRAVITY, DRY_MASS, THRUSTER_FORCE, RCS_TORQUE, MOMENT_OF_INERTIA, FUEL_CONSUMPTION_RATE

# Initialize user variables (persist between timesteps)
${varInit}
# User's control code runs every physics timestep
async def user_control():
${globalDecl}    # User code below
${userCode.replace(/^/gm, '    ')}

# Register the control function with the physics engine
set_control_function(user_control)
`;
    console.log("Generated Python code:");
    console.log(wrappedCode);
    console.log("Variables detected:", varNames);

    try {
      // Load the control function
      await pyodide.runPythonAsync(wrappedCode);
      console.log("Control function loaded");

      // Load scenario and start simulation
      const s = currentLevel.scenario;
      await pyodide.runPythonAsync(
        `load_scenario(${s.x}, ${s.y}, ${s.vx}, ${s.vy}, ${s.angle}, ${s.angularVelocity}, ${s.fuel})`
      );
      const t = currentLevel.target;
      await pyodide.runPythonAsync(t != null ? `set_target(${t.x})` : `clear_target()`);
      gameStarted = true;
      console.log("Simulation started");
      addToConsole("Simulation started!");
      addToConsole(`Starting fuel: ${s.fuel.toFixed(2)} kg`);
      if (levelMode === 'both') addToConsole("Press 'M' to toggle manual control");
    } catch (err) {
      console.error("Error setting up control code:", err);
      addToConsole(`ERROR: ${err.message}`);
    }
  });

  // ===== RESIZABLE PANELS =====
  const blocklyDivEl    = document.getElementById('blocklyDiv');
  const hResizerEl      = document.getElementById('hResizer');
  const gameContainerEl = document.getElementById('gameContainer');
  const vResizerEl      = document.getElementById('vResizer');

  // Horizontal resizer: drag to resize Blockly vs right panel
  let hDragging = false, hStartX = 0, hStartW = 0;

  hResizerEl.addEventListener('mousedown', (e) => {
    hDragging = true;
    hStartX = e.clientX;
    hStartW = blocklyDivEl.getBoundingClientRect().width;
    hResizerEl.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!hDragging) return;
    const newW = Math.max(150, Math.min(window.innerWidth - 250, hStartW + (e.clientX - hStartX)));
    blocklyDivEl.style.flex = `0 0 ${newW}px`;
    Blockly.svgResize(workspace);
  });

  document.addEventListener('mouseup', () => {
    if (!hDragging) return;
    hDragging = false;
    hResizerEl.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    Blockly.svgResize(workspace);
  });

  // Vertical resizer: drag to resize game canvas vs console
  let vDragging = false, vStartY = 0, vStartH = 0;

  vResizerEl.addEventListener('mousedown', (e) => {
    vDragging = true;
    vStartY = e.clientY;
    vStartH = gameContainerEl.getBoundingClientRect().height;
    vResizerEl.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!vDragging) return;
    const newH = Math.max(80, Math.min(window.innerHeight - 80, vStartH + (e.clientY - vStartY)));
    gameContainerEl.style.flex = `0 0 ${newH}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!vDragging) return;
    vDragging = false;
    vResizerEl.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// Camera system - tracks the lander's position
let cameraX = 0;  // Camera position in meters
let cameraY = 50; // Camera position in meters
let crashTime = null;  // Timestamp when crash occurred
let allowSuccessOverlay = false;  // Only allow success after we've confirmed simulation reset

// Infinite scrolling star system with deterministic generation
let starCache = new Map(); // Cache stars by chunk ID
const STAR_DENSITY = 0.004;  // Stars per square meter
const CHUNK_SIZE = 100; // Size of each star generation chunk in meters

// Simple seeded random number generator
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate stars for a specific chunk (deterministic based on chunk coordinates)
function generateChunkStars(chunkX, chunkY) {
  const stars = [];
  const chunkId = `${chunkX},${chunkY}`;

  // Use chunk coordinates as seed for consistent generation
  const baseSeed = chunkX * 73856093 + chunkY * 19349663;

  // Calculate how many stars should be in this chunk
  const numStars = Math.floor(CHUNK_SIZE * CHUNK_SIZE * STAR_DENSITY);

  for (let i = 0; i < numStars; i++) {
    const seed = baseSeed + i * 12345;
    const x = chunkX * CHUNK_SIZE + seededRandom(seed) * CHUNK_SIZE;
    const y = chunkY * CHUNK_SIZE + seededRandom(seed + 1) * CHUNK_SIZE;
    const size = seededRandom(seed + 2) * 1.5 + 0.5;
    const parallax = seededRandom(seed + 3) * 0.4 + 0.3; // 0.3-0.7 parallax

    stars.push({ x, y, size, parallax });
  }

  return stars;
}

// Update visible stars based on camera position
function updateStars(cameraX, cameraY, canvasW, canvasH) {
  const scaleX = 8;
  const scaleY = 8;

  // Calculate visible world area with margins
  const margin = 200; // Margin in meters
  const visibleWidth = canvasW / scaleX + margin * 2;
  const visibleHeight = canvasH / scaleY + margin * 2;

  const minX = cameraX - visibleWidth / 2;
  const maxX = cameraX + visibleWidth / 2;
  const minY = cameraY - visibleHeight / 2;
  const maxY = cameraY + visibleHeight / 2;

  // Determine which chunks are visible
  const minChunkX = Math.floor(minX / CHUNK_SIZE);
  const maxChunkX = Math.ceil(maxX / CHUNK_SIZE);
  const minChunkY = Math.floor(minY / CHUNK_SIZE);
  const maxChunkY = Math.ceil(maxY / CHUNK_SIZE);

  // Generate stars for visible chunks
  const visibleChunks = new Set();
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      const chunkId = `${cx},${cy}`;
      visibleChunks.add(chunkId);

      // Generate chunk if not cached
      if (!starCache.has(chunkId)) {
        starCache.set(chunkId, generateChunkStars(cx, cy));
      }
    }
  }

  // Remove chunks that are too far away (keep cache small)
  const maxCacheDistance = 3; // Keep chunks within 3 chunks of visible area
  for (const [chunkId, _] of starCache) {
    const [cx, cy] = chunkId.split(',').map(Number);
    if (cx < minChunkX - maxCacheDistance || cx > maxChunkX + maxCacheDistance ||
        cy < minChunkY - maxCacheDistance || cy > maxChunkY + maxCacheDistance) {
      starCache.delete(chunkId);
    }
  }
}

// Mars crater system
let craterCache = new Map();
const CRATER_CHUNK_SIZE = 100;

function generateChunkCraters(chunkX) {
  const craters = [];
  const baseSeed = chunkX * 48271 + 99013;
  // Fixed-width slots guarantee no overlap
  // Fixed-width slots guarantee no overlap
  const slotSize = 20; // meters between slots
  const numSlots = Math.floor(CRATER_CHUNK_SIZE / slotSize);
  for (let i = 0; i < numSlots; i++) {
    const seed = baseSeed + i * 999983;
    if (seededRandom(seed) > 0.5) continue; // 50% chance per slot
    const xOffset = slotSize * 0.1 + seededRandom(seed + 1) * slotSize * 0.8;
    const x = chunkX * CRATER_CHUNK_SIZE + i * slotSize + xOffset;
    const radius = seededRandom(seed + 2) * 6 + 1.5; // 1.5–7.5 meters
    craters.push({ x, radius });
  }
  return craters;
}

function updateCraters(cameraX, canvasW) {
  const margin = 50;
  const visibleWidth = canvasW / 8 + margin * 2;
  const minX = cameraX - visibleWidth / 2;
  const maxX = cameraX + visibleWidth / 2;
  const minChunkX = Math.floor(minX / CRATER_CHUNK_SIZE);
  const maxChunkX = Math.ceil(maxX / CRATER_CHUNK_SIZE);
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    const id = `${cx}`;
    if (!craterCache.has(id)) craterCache.set(id, generateChunkCraters(cx));
  }
  for (const [id] of craterCache) {
    const cx = parseInt(id);
    if (cx < minChunkX - 2 || cx > maxChunkX + 2) craterCache.delete(id);
  }
}

// ===== MOUNTAIN RIDGE SYSTEM =====
const MOUNTAIN_LAYERS = [
  { parallax: 0.06, color: '#2e0e06', heightScale: 100 }, // far: darkest, tallest
  { parallax: 0.16, color: '#4c1409', heightScale: 66 }, // mid
  { parallax: 0.30, color: '#6e1c0b', heightScale: 33  }, // near: lighter, shorter
];

// Large offsets per layer so peaks don't line up across layers
const MOUNTAIN_PHASE_OFFSETS = [0, 114, 267];

function getMountainHeight(wx, layerIdx) {
  const s = 0.010 + layerIdx * 0.004;
  const p = MOUNTAIN_PHASE_OFFSETS[layerIdx];
  let h = Math.sin((wx + p)         * s)               * 0.38
         + Math.sin((wx + p * 1.61) * s * 2.1  + 1.3)  * 0.26
         + Math.sin((wx + p * 2.41) * s * 4.7  + 2.8)  * 0.18
         + Math.sin((wx + p * 3.73) * s * 9.3  + 0.5)  * 0.10
         + Math.sin((wx + p * 5.83) * s * 17.1 + 3.9)  * 0.05
         + 0.03;
  return Math.max(0, h) * MOUNTAIN_LAYERS[layerIdx].heightScale;
}

function drawMountainLayer(ctx, layerIdx, stateX, canvasW, canvasH, landerScreenX, groundScreenY, scaleX, scaleY) {
  const layer = MOUNTAIN_LAYERS[layerIdx];
  if (groundScreenY - layer.heightScale * scaleY > canvasH) return; // entirely off-screen below
  const step = 5;
  ctx.fillStyle = layer.color;
  ctx.beginPath();
  ctx.moveTo(-step, groundScreenY);
  for (let sx = -step; sx <= canvasW + step; sx += step) {
    const wx = stateX * layer.parallax + (sx - landerScreenX) / scaleX;
    ctx.lineTo(sx, groundScreenY - getMountainHeight(wx, layerIdx) * scaleY);
  }
  ctx.lineTo(canvasW + step, groundScreenY);
  ctx.closePath();
  ctx.fill();
}

// ===== SURFACE ROCK SYSTEM =====
let rockCache = new Map();

function generateChunkRocks(chunkX) {
  const rocks = [];
  const baseSeed = chunkX * 99991 + 77777;
  const slotSize = 4;
  const numSlots = Math.floor(CRATER_CHUNK_SIZE / slotSize);
  for (let i = 0; i < numSlots; i++) {
    const seed = baseSeed + i * 8191;
    if (seededRandom(seed) > 0.32) continue;
    const x  = chunkX * CRATER_CHUNK_SIZE + i * slotSize + seededRandom(seed + 1) * slotSize * 0.85;
    const w  = seededRandom(seed + 2) * 1.3 + 0.3;
    const h  = w * (0.35 + seededRandom(seed + 3) * 0.4);
    const dark = seededRandom(seed + 4) > 0.5;
    rocks.push({ x, w, h, dark });
  }
  return rocks;
}

function updateRocks(cameraX, canvasW) {
  const visibleWidth = canvasW / 8 + 100;
  const minChunkX = Math.floor((cameraX - visibleWidth / 2) / CRATER_CHUNK_SIZE);
  const maxChunkX = Math.ceil( (cameraX + visibleWidth / 2) / CRATER_CHUNK_SIZE);
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    const id = `${cx}`;
    if (!rockCache.has(id)) rockCache.set(id, generateChunkRocks(cx));
  }
  for (const [id] of rockCache) {
    const cx = parseInt(id);
    if (cx < minChunkX - 2 || cx > maxChunkX + 2) rockCache.delete(id);
  }
}

// ===== DUST PARTICLE SYSTEM =====
let dustParticles = [];
let dustLandingTriggered = false;

function spawnDust(worldX, worldY, count, speedScale) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const speed = (Math.random() * 5 + 2) * speedScale;
    dustParticles.push({
      x:      worldX + (Math.random() - 0.5) * 3,
      y:      worldY,
      vx:     Math.cos(angle) * speed,
      vy:     Math.abs(Math.sin(angle)) * speed * 0.7 + 0.5,
      alpha:  0.4 + Math.random() * 0.4,
      size:   Math.random() * 2.5 + 0.8,
      age:    0,
      maxAge: 0.9 + Math.random() * 1.4,
    });
  }
}

// render loop - runs at 60 FPS while physics runs independently at high frequency
function update() {
  if (!ctx) {
    requestAnimationFrame(update);
    return;
  }

  // Sync canvas resolution to its display size
  const canvas = ctx.canvas;
  const cw = canvas.clientWidth || 1200;
  const ch = canvas.clientHeight || 800;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  if (!gameStarted || !pyodide) {
    // Clear canvas to black when not started
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(update);
    return;
  }

  // Query state only for rendering (physics runs independently)
  pyodide.runPythonAsync(`get_state()`).then(result => {
    const state = JSON.parse(result.toJs ? JSON.stringify(result.toJs()) : result);

    // Update camera to follow lander position
    cameraX = state.x;
    cameraY = state.y;

    // Lander is always centered on screen — canvas size determines how much world is visible
    const landerScreenX = canvas.width / 2;
    const landerScreenY = canvas.height / 2;

    // Fixed physics scale: 8 pixels per meter (never changes with resize)
    const scaleX = 8;
    const scaleY = 8;

    // Update stars for infinite scrolling
    updateStars(cameraX, cameraY, canvas.width, canvas.height);

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw ALL background stars with parallax on both axes
    // Stars fade out below 600m and are gone by 200m
    const starAlpha = Math.max(0, Math.min(1, (state.y - 200) / 400));
    if (starAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
      for (const [chunkId, chunkStars] of starCache) {
        chunkStars.forEach(star => {
          const offsetX = (star.x - cameraX) * scaleX * star.parallax;
          const offsetY = (star.y - cameraY) * scaleY * star.parallax;
          const starScreenX = landerScreenX + offsetX;
          const starScreenY = landerScreenY - offsetY;
          ctx.beginPath();
          ctx.arc(starScreenX, starScreenY, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Calculate ground position
    const groundScreenY = landerScreenY - ((0 - cameraY) * scaleY);  // Ground is at y=0

    // Mars atmospheric haze — pure space above 1000m, dusty orange haze near surface
    {
      const atmosFactor = Math.max(0, Math.min(1, 1 - state.y / 1000));
      if (atmosFactor > 0.005) {
        const haze = ctx.createLinearGradient(0, 0, 0, canvas.height);
        haze.addColorStop(0,   `rgba(200, 90, 35, ${0.40 * atmosFactor})`);
        haze.addColorStop(1,   `rgba(220, 110, 45, ${0.60 * atmosFactor})`);
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Draw mountain ridge silhouettes (back to front, parallax)
    for (let li = 0; li < MOUNTAIN_LAYERS.length; li++) {
      drawMountainLayer(ctx, li, state.x, canvas.width, canvas.height, landerScreenX, groundScreenY, scaleX, scaleY);
    }

    // Draw filled ground surface (gradient for depth)
    const groundGrad = ctx.createLinearGradient(0, groundScreenY, 0, groundScreenY + 120);
    groundGrad.addColorStop(0,   '#c84a22');
    groundGrad.addColorStop(0.2, '#b54020');
    groundGrad.addColorStop(1,   '#8a2e14');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundScreenY, canvas.width, canvas.height - groundScreenY);

    // Draw world center line (x=0 in physics coordinates)
    ctx.fillStyle = "rgba(200, 80, 30, 0.3)";
    const centerLineX = landerScreenX + ((0 - cameraX) * scaleX);
    ctx.fillRect(centerLineX - 1, groundScreenY, 2, canvas.height - groundScreenY);

    // Draw Mars craters (dark semi-ellipses into the ground)
    updateCraters(cameraX, canvas.width);
    for (const [, craters] of craterCache) {
      for (const crater of craters) {
        const cx = landerScreenX + ((crater.x - cameraX) * scaleX);
        const cy = groundScreenY;
        const rw = crater.radius * scaleX;
        const rh = rw * 0.55; // shallow bowl
        if (cx + rw < 0 || cx - rw > canvas.width) continue;

        ctx.fillStyle = '#3a0a02';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI); // bottom half only
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw landing target zone
    if (currentLevel && currentLevel.target != null) {
      const tx = currentLevel.target.x;
      const tsx = landerScreenX + ((tx - cameraX) * scaleX);
      const tsy = groundScreenY;
      const tr  = 10 * scaleX; // 10 m radius in pixels

      if (tsx + tr > 0 && tsx - tr < canvas.width) {
        ctx.save();

        // Soft radial glow above ground
        const glow = ctx.createRadialGradient(tsx, tsy, 0, tsx, tsy, tr);
        glow.addColorStop(0,   'rgba(0, 255, 80, 0.10)');
        glow.addColorStop(0.6, 'rgba(0, 255, 80, 0.05)');
        glow.addColorStop(1,   'rgba(0, 255, 80, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tsx, tsy, tr, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Ground zone highlight strip
        const strip = ctx.createLinearGradient(tsx - tr, 0, tsx + tr, 0);
        strip.addColorStop(0,   'rgba(0, 200, 60, 0)');
        strip.addColorStop(0.15,'rgba(0, 200, 60, 0.25)');
        strip.addColorStop(0.5, 'rgba(0, 220, 80, 0.35)');
        strip.addColorStop(0.85,'rgba(0, 200, 60, 0.25)');
        strip.addColorStop(1,   'rgba(0, 200, 60, 0)');
        ctx.fillStyle = strip;
        ctx.fillRect(tsx - tr, tsy, tr * 2, 5);

        // Outer edge ticks (L-brackets)
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1.5;
        const tk = 10; // tick size px
        // Left bracket
        ctx.beginPath();
        ctx.moveTo(tsx - tr + tk, tsy);
        ctx.lineTo(tsx - tr, tsy);
        ctx.lineTo(tsx - tr, tsy - tk * 2);
        ctx.stroke();
        // Right bracket
        ctx.beginPath();
        ctx.moveTo(tsx + tr - tk, tsy);
        ctx.lineTo(tsx + tr, tsy);
        ctx.lineTo(tsx + tr, tsy - tk * 2);
        ctx.stroke();

        // Center diamond
        const ds = 5;
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(tsx,      tsy - ds * 2);
        ctx.lineTo(tsx + ds, tsy - ds);
        ctx.lineTo(tsx,      tsy);
        ctx.lineTo(tsx - ds, tsy - ds);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }

    // Draw lander at center of screen (scaled down to 65%)
    ctx.save();
    ctx.translate(landerScreenX, landerScreenY);
    ctx.rotate(state.angle);
    ctx.scale(0.65, 0.65);

    // Check if crashed or landed successfully
    const crashed = state.crashed || false;
    const landedSafely = state.landed_safely || false;

    // Show success overlay only when transitioning from not landed to landed
    if (landedSafely && !previousLandedState) {
      previousLandedState = true;
      const totalVelocity = Math.sqrt(state.vx**2 + state.vy**2);
      document.getElementById('successStats').innerHTML = `
        Landed at ${totalVelocity.toFixed(2)} m/s<br>
        Position: ${state.x.toFixed(1)} m<br>
        Fuel remaining: ${state.fuel.toFixed(3)} kg
      `;
      document.getElementById('successOverlay').style.display = 'flex';
    }

    // Missed target — show failure overlay once
    if ((state.missed_target || false) && !previousLandedState) {
      previousLandedState = true;
      const tx = currentLevel?.target?.x ?? 0;
      const overshoot = (Math.abs(state.x - tx) - 10).toFixed(1);
      const dir = state.x > tx ? 'right' : 'left';
      document.getElementById('failureTitle').textContent = 'MISSED!';
      document.getElementById('failureStats').innerHTML =
        `Landed ${overshoot}m too far ${dir}<br>` +
        `Position: ${state.x.toFixed(1)}m &nbsp;|&nbsp; Target: ±10m of ${tx.toFixed(0)}m`;
      document.getElementById('failureOverlay').style.display = 'flex';
    }

    // Crash — show failure overlay once (after explosion animation)
    if (crashed && crashTime === null) {
      crashTime = Date.now();
    }
    if (crashed && crashTime !== null && !previousLandedState) {
      const timeSinceCrash = (Date.now() - crashTime) / 1000;
      if (timeSinceCrash >= 1.0) {
        previousLandedState = true;
        const totalVelocity = Math.sqrt(state.vx**2 + state.vy**2);
        document.getElementById('failureTitle').textContent = 'CRASH!';
        document.getElementById('failureStats').innerHTML =
          `Impact velocity: ${totalVelocity.toFixed(2)} m/s<br>` +
          `Position: ${state.x.toFixed(1)}m`;
        document.getElementById('failureOverlay').style.display = 'flex';
      }
    }
    if (!crashed) crashTime = null;

    // Only draw RCS and throttle effects if not crashed
    if (!crashed) {
      // Draw RCS exhaust effects
      const rcsValue = state.rcs_value || 0;

      if (rcsValue < 0) {
        // Negative RCS = CCW rotation (fires from left side)
        const rcsMagnitude = Math.abs(rcsValue);
        const rcsLength = (8 + Math.random() * 4) * rcsMagnitude;
        const rcsWidth = 3 * rcsMagnitude;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * rcsMagnitude})`;
        ctx.beginPath();
        ctx.moveTo(-14, -5);  // Left side of lander
        ctx.lineTo(-14 - rcsLength, -5 - rcsWidth);
        ctx.lineTo(-14 - rcsLength, -5 + rcsWidth);
        ctx.closePath();
        ctx.fill();
      }

      if (rcsValue > 0) {
        // Positive RCS = CW rotation (fires from right side)
        const rcsMagnitude = Math.abs(rcsValue);
        const rcsLength = (8 + Math.random() * 4) * rcsMagnitude;
        const rcsWidth = 3 * rcsMagnitude;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * rcsMagnitude})`;
        ctx.beginPath();
        ctx.moveTo(14, -5);  // Right side of lander
        ctx.lineTo(14 + rcsLength, -5 - rcsWidth);
        ctx.lineTo(14 + rcsLength, -5 + rcsWidth);
        ctx.closePath();
        ctx.fill();
      }

      // Draw flame effect (scales with throttle) - only if we have fuel
      const throttle = state.throttle || 0;
      const fuel = state.fuel || 0;
      if (throttle > 0 && fuel > 0) {
        const flameLength = 20 + (throttle * 40); // 20-60px flame
        const flameWidth = 8 + (throttle * 8);    // 8-16px wide

        // Flame gradient (orange to yellow)
        const gradient = ctx.createLinearGradient(0, 20, 0, 20 + flameLength);
        gradient.addColorStop(0, '#ff6600');  // Orange at base
        gradient.addColorStop(0.5, '#ff9933'); // Lighter orange
        gradient.addColorStop(1, '#ffcc00');   // Yellow at tip

        // Draw flame as animated triangles
        const flameFlicker = Math.random() * 0.15 + 0.85; // 0.85-1.0 for flicker
        ctx.fillStyle = gradient;

        // Main flame
        ctx.beginPath();
        ctx.moveTo(0, 20);  // Top of flame (at thruster)
        ctx.lineTo(-flameWidth * flameFlicker, 20 + flameLength * 0.6);
        ctx.lineTo(0, 20 + flameLength * flameFlicker);
        ctx.lineTo(flameWidth * flameFlicker, 20 + flameLength * 0.6);
        ctx.closePath();
        ctx.fill();

        // Inner bright core
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(-flameWidth * 0.4, 20 + flameLength * 0.4);
        ctx.lineTo(0, 20 + flameLength * 0.5);
        ctx.lineTo(flameWidth * 0.4, 20 + flameLength * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Track when crash happened
    if (crashed && crashTime === null) {
      crashTime = Date.now();
    }
    if (!crashed) {
      crashTime = null;
    }

    // Show explosion for 1 second with fade
    if (crashed && crashTime !== null) {
      const timeSinceCrash = (Date.now() - crashTime) / 1000; // in seconds
      const explosionDuration = 1.0; // 1 second

      if (timeSinceCrash < explosionDuration) {
        const fadeProgress = timeSinceCrash / explosionDuration;
        const fadeAlpha = 1 - fadeProgress; // 1.0 to 0.0

        // Draw large explosion with multiple layers
        // Outer blast wave (orange) - expands and fades
        const blastRadius = 35 + (timeSinceCrash * 30) + Math.sin(Date.now() * 0.01) * 8;
        const blastGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, blastRadius);
        blastGradient.addColorStop(0, `rgba(255, 200, 0, ${0.8 * fadeAlpha})`);
        blastGradient.addColorStop(0.3, `rgba(255, 100, 0, ${0.6 * fadeAlpha})`);
        blastGradient.addColorStop(0.6, `rgba(255, 50, 0, ${0.3 * fadeAlpha})`);
        blastGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = blastGradient;
        ctx.beginPath();
        ctx.arc(0, 0, blastRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bright core - fades faster
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${fadeAlpha})`);
        coreGradient.addColorStop(0.4, `rgba(255, 255, 100, ${0.9 * fadeAlpha})`);
        coreGradient.addColorStop(1, `rgba(255, 150, 0, ${0.5 * fadeAlpha})`);
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Flying debris pieces - expand outward
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const dist = 20 + (timeSinceCrash * 40) + Math.sin(Date.now() * 0.005 + i) * 10;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle + timeSinceCrash * 5);
          ctx.globalAlpha = fadeAlpha;
          ctx.fillStyle = "#555";
          ctx.fillRect(-3, -3, 6, 6);
          ctx.restore();
        }

        // Sparks/fire particles - fade out
        ctx.globalAlpha = fadeAlpha;
        for (let i = 0; i < 25; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 40 + (timeSinceCrash * 20);
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          const sparkSize = Math.random() * 2 + 1;

          ctx.fillStyle = `rgba(255, ${150 + Math.random() * 105}, 0, ${Math.random() * 0.8})`;
          ctx.beginPath();
          ctx.arc(x, y, sparkSize, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0; // Reset alpha
      }
      // After explosion fades completely, nothing is drawn
    }

    if (!crashed) {
      // Draw custom lander sprite (normal)
      // Main body (capsule)
      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.ellipse(0, -10, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit window
      ctx.fillStyle = "#4af";
      ctx.beginPath();
      ctx.arc(0, -15, 6, 0, Math.PI * 2);
      ctx.fill();

      // Window highlight
      ctx.fillStyle = "#8cf";
      ctx.beginPath();
      ctx.arc(-2, -17, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Landing legs (left)
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, 5);
      ctx.lineTo(-18, 18);
      ctx.lineTo(-22, 18);
      ctx.stroke();

      // Landing legs (right)
      ctx.beginPath();
      ctx.moveTo(10, 5);
      ctx.lineTo(18, 18);
      ctx.lineTo(22, 18);
      ctx.stroke();

      // Thruster nozzle
      ctx.fillStyle = "#444";
      ctx.fillRect(-6, 8, 12, 12);
      ctx.fillStyle = "#222";
      ctx.fillRect(-4, 10, 8, 10);

      // Body outline
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -10, 14, 18, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Direction indicator line (optional - shows which way is "up" for the lander)
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(0, -20);
      ctx.stroke();
    }

    ctx.restore();

    // Draw telemetry text (compact)
    ctx.fillStyle = "#0f0";
    ctx.font = "12px monospace";
    ctx.fillText(`X: ${state.x.toFixed(1)} m`, 10, 20);
    ctx.fillText(`Alt: ${state.y.toFixed(1)} m`, 10, 36);
    ctx.fillText(`Vx: ${state.vx.toFixed(2)} m/s`, 10, 52);
    ctx.fillText(`Vy: ${state.vy.toFixed(2)} m/s`, 10, 68);
    ctx.fillText(`Angle: ${(state.angle * 180 / Math.PI).toFixed(1)}°`, 10, 84);
    ctx.fillText(`ω: ${state.angular_velocity.toFixed(2)} rad/s`, 10, 100);
    const throttlePercent = ((state.throttle || 0) * 100).toFixed(0);
    ctx.fillText(`Throttle: ${throttlePercent}%`, 10, 116);

    // Draw time warp indicator
    const timeWarp = state.time_warp || 1.0;
    if (timeWarp !== 1.0) {
      ctx.fillStyle = "#ff0";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`Time: ${timeWarp.toFixed(1)}x`, 10, 140);
    }

    // Draw fuel with color coding
    const fuelKg = state.fuel || 0;
    const initialFuel = state.initial_fuel || 0.5;
    const fuelPercent = (fuelKg / initialFuel) * 100;
    if (fuelPercent > 30) {
      ctx.fillStyle = "#0f0";
    } else if (fuelPercent > 10) {
      ctx.fillStyle = "#ff0";
    } else {
      ctx.fillStyle = "#f00";
    }
    ctx.fillText(`Fuel: ${fuelKg.toFixed(3)} kg (${fuelPercent.toFixed(0)}%)`, 10, 132);

    // Mini-map: always visible, anchored to bottom-right corner
    {
      const mapW = 190, mapH = 160;
      const mapX = canvas.width - mapW - 10;
      const mapY = canvas.height - mapH - 10;
      const labelH = 14;
      const pad = 8;
      const innerX = mapX + pad;
      const innerY = mapY + labelH + pad;
      const innerW = mapW - pad * 2;
      const innerH = mapH - labelH - pad * 2;

      // Background + border
      ctx.fillStyle = 'rgba(0, 10, 0, 0.88)';
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      // Label
      ctx.fillStyle = '#0f0';
      ctx.font = '10px monospace';
      ctx.fillText('OVERVIEW', mapX + 5, mapY + 10);

      // Scale is fixed to the level's starting conditions
      const startY   = currentLevel ? currentLevel.scenario.y : Math.max(state.y, 300);
      const startX   = currentLevel ? currentLevel.scenario.x : state.x;
      const targetX  = (currentLevel && currentLevel.target != null) ? currentLevel.target.x : null;

      const maxAlt = startY * 1.25;
      const aspect = innerW / innerH;
      const hRange = maxAlt * aspect;
      const worldX0 = state.x - hRange / 2; // always centered on ship

      const toMX = (wx) => innerX + ((wx - worldX0) / hRange) * innerW;
      const toMY = (wy) => innerY + (1 - wy / maxAlt) * innerH;

      // Clip to inner map area
      ctx.save();
      ctx.beginPath();
      ctx.rect(innerX, innerY, innerW, innerH);
      ctx.clip();

      // Ground fill (Mars color in minimap)
      const groundMY = toMY(0);
      ctx.fillStyle = '#7a2810';
      ctx.fillRect(innerX, groundMY, innerW, innerY + innerH - groundMY);

      // Ground line
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerX, groundMY);
      ctx.lineTo(innerX + innerW, groundMY);
      ctx.stroke();

      // Predicted ballistic trajectory (no thrust assumed)
      if (state.y > 0 && !state.crashed && !state.landed_safely) {
        const g = 9.8;
        const disc = state.vy * state.vy + 2 * g * state.y;
        if (disc >= 0) {
          const tImpact = (state.vy + Math.sqrt(disc)) / g;
          const steps = 50;
          ctx.strokeStyle = 'rgba(0, 200, 0, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          let started = false;
          for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * tImpact;
            const px = state.x + state.vx * t;
            const py = state.y + state.vy * t - 0.5 * g * t * t;
            if (py < 0) break;
            const pmx = toMX(px);
            const pmy = toMY(py);
            if (!started) { ctx.moveTo(pmx, pmy); started = true; }
            else ctx.lineTo(pmx, pmy);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Target landing marker
      if (targetX != null) {
        const tMX = toMX(targetX);
        // Vertical tick on ground line
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tMX, groundMY - 7);
        ctx.lineTo(tMX, groundMY + 3);
        ctx.stroke();
        // Small triangle pointing down to ground
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(tMX - 4, groundMY - 7);
        ctx.lineTo(tMX + 4, groundMY - 7);
        ctx.lineTo(tMX, groundMY - 1);
        ctx.closePath();
        ctx.fill();
      }

      // Ship dot
      const shipMX = toMX(state.x);
      const shipMY = toMY(state.y);
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(shipMX, shipMY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // remove clip

      // Off-screen edge indicators (drawn outside clip so they sit on the border)
      const edgeArrow = (mx, my, color) => {
        const s = 5; // arrow half-size
        const pad = 4;
        const clampY = Math.max(innerY + pad + s, Math.min(innerY + innerH - pad - s, my));
        const clampX = Math.max(innerX + pad + s, Math.min(innerX + innerW - pad - s, mx));
        ctx.fillStyle = color;
        if (mx < innerX) {
          ctx.beginPath();
          ctx.moveTo(innerX - 1,     clampY);
          ctx.lineTo(innerX + s + 1, clampY - s);
          ctx.lineTo(innerX + s + 1, clampY + s);
          ctx.closePath(); ctx.fill();
        } else if (mx > innerX + innerW) {
          ctx.beginPath();
          ctx.moveTo(innerX + innerW + 1,     clampY);
          ctx.lineTo(innerX + innerW - s - 1, clampY - s);
          ctx.lineTo(innerX + innerW - s - 1, clampY + s);
          ctx.closePath(); ctx.fill();
        }
        if (my < innerY) {
          ctx.beginPath();
          ctx.moveTo(clampX,     innerY - 1);
          ctx.lineTo(clampX - s, innerY + s + 1);
          ctx.lineTo(clampX + s, innerY + s + 1);
          ctx.closePath(); ctx.fill();
        } else if (my > innerY + innerH) {
          ctx.beginPath();
          ctx.moveTo(clampX,     innerY + innerH + 1);
          ctx.lineTo(clampX - s, innerY + innerH - s - 1);
          ctx.lineTo(clampX + s, innerY + innerH - s - 1);
          ctx.closePath(); ctx.fill();
        }
      };

      edgeArrow(shipMX, shipMY, '#0f0');
      if (targetX != null) edgeArrow(toMX(targetX), toMY(0), '#ff0');

    }

  }).catch(err => {
    console.error("Error in update loop:", err);
  }).finally(() => {
    requestAnimationFrame(update);  // Render at 60 FPS
  });
}

init();
