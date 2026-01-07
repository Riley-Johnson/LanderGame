let workspace, pyodide, ctx, gameStarted = false;
let currentLevel = null;
let LEVELS = []; // Will be loaded from files

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
    scenario: { ...DEFAULT_SCENARIO, ...levelData.scenario }
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
  // Load levels first
  await loadLevels();

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
          <block type="rotate_left"></block>
          <block type="rotate_right"></block>
        </category>
        <category name="Sensors" colour="120">
          <block type="get_throttle"></block>
          <block type="get_altitude"></block>
          <block type="get_velocity"></block>
          <block type="get_horizontal_position"></block>
          <block type="get_horizontal_velocity"></block>
          <block type="get_angle"></block>
          <block type="get_angle_degrees"></block>
          <block type="get_angular_velocity"></block>
        </category>
        <category name="Variables" colour="330" custom="VARIABLE"></category>
        <category name="Time" colour="290">
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
    sounds: false  // Disable sounds to avoid CORS issues with cross-origin isolation
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

  // start draw loop immediately
  requestAnimationFrame(update);

  // load Pyodide and our Python physics from separate file
  pyodide = await loadPyodide();

  // Redirect Python stdout to our console
  pyodide.setStdout({
    batched: (text) => {
      addToConsole(text);
    }
  });

  const physicsCode = await fetch('physics.py?v=6').then(r => r.text());
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

  // Menu button handler
  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById('levelSelectOverlay').style.display = 'flex';
    addToConsole("Returning to level select menu...");
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
      manualControlEnabled = !manualControlEnabled;
      const status = manualControlEnabled ? "ENABLED" : "DISABLED";
      addToConsole(`Manual control ${status} (W/S: throttle, A/D: rotate)`);
      console.log(`Manual control: ${status}`);
      if (!manualControlEnabled) {
        currentThrottle = 0.0;
        if (gameStarted) {
          pyodide.runPythonAsync('set_throttle(0.0)').catch(err => console.error(err));
        }
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

    // A or Left Arrow: Rotate right (reversed for intuitive control)
    if (keysPressed["a"] || keysPressed["A"] || keysPressed["ArrowLeft"]) {
      pyodide.runPythonAsync('rotate_right()').catch(err => console.error(err));
    }

    // D or Right Arrow: Rotate left (reversed for intuitive control)
    if (keysPressed["d"] || keysPressed["D"] || keysPressed["ArrowRight"]) {
      pyodide.runPythonAsync('rotate_left()').catch(err => console.error(err));
    }
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

    // Reset crash timer
    crashTime = null;

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

    // If there's no code, add a pass statement to avoid IndentationError
    userCode = userCode.trim() ? userCode : 'pass';

    // Wrap user code in an async control function that runs every timestep
    const wrappedCode = `
import asyncio

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
      gameStarted = true;
      console.log("Simulation started");
      addToConsole("Simulation started!");
      addToConsole(`Starting fuel: ${s.fuel.toFixed(2)} kg`);
      addToConsole("Press 'M' to toggle manual control");
    } catch (err) {
      console.error("Error setting up control code:", err);
      addToConsole(`ERROR: ${err.message}`);
    }
  });
}

// Camera system - tracks the lander's position
let cameraX = 0;  // Camera position in meters
let cameraY = 50; // Camera position in meters
let crashTime = null;  // Timestamp when crash occurred

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
    const parallax = seededRandom(seed + 3) * 0.4 + 0.3;

    stars.push({ x, y, size, parallax });
  }

  return stars;
}

// Update visible stars based on camera position
function updateStars(cameraX, cameraY) {
  const scaleX = 3;
  const scaleY = 8;

  // Calculate visible world area with margins
  const margin = 200; // Margin in meters
  const visibleWidth = 1200 / scaleX + margin * 2;
  const visibleHeight = 800 / scaleY + margin * 2;

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

// render loop
function update() {
  if (!ctx) {
    requestAnimationFrame(update);
    return;
  }

  if (!gameStarted || !pyodide) {
    // Clear canvas to black when not started
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1200, 800);
    requestAnimationFrame(update);
    return;
  }

  pyodide.runPythonAsync(`get_state()`).then(result => {
    const state = JSON.parse(result.toJs ? JSON.stringify(result.toJs()) : result);

    // Update camera to follow lander position
    cameraX = state.x;
    cameraY = state.y;

    // Update stars for infinite scrolling
    updateStars(cameraX, cameraY);

    // Lander is always centered on screen
    const landerScreenX = 600;  // Center of 1200px canvas
    const landerScreenY = 400;  // Center of 800px canvas

    // Scaling constants
    const scaleX = 3;  // 3 pixels per meter horizontally
    const scaleY = 8;  // 8 pixels per meter vertically

    // debug: log state occasionally
    if (Math.random() < 0.01) {
      console.log(`Lander: x=${state.x.toFixed(1)}m, alt=${state.y.toFixed(1)}m, vx=${state.vx.toFixed(2)}m/s, vy=${state.vy.toFixed(2)}m/s`);
    }

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1200, 800);

    // Draw ALL background stars with parallax effect from cached chunks
    ctx.fillStyle = "#fff";
    for (const [chunkId, chunkStars] of starCache) {
      chunkStars.forEach(star => {
        // Convert star world position to screen position with parallax
        const starScreenX = landerScreenX + ((star.x - cameraX) * scaleX * star.parallax);
        const starScreenY = landerScreenY - ((star.y - cameraY) * scaleY * star.parallax);

        // Draw all stars
        ctx.beginPath();
        ctx.arc(starScreenX, starScreenY, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Calculate ground position
    const groundScreenY = landerScreenY - ((0 - cameraY) * scaleY);  // Ground is at y=0

    // Draw filled ground surface
    ctx.fillStyle = "#3a3a3a";  // Dark gray lunar surface
    ctx.fillRect(0, groundScreenY, 1200, 800 - groundScreenY);

    // Draw world center line (x=0 in physics coordinates)
    ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
    const centerLineX = landerScreenX + ((0 - cameraX) * scaleX);
    ctx.fillRect(centerLineX - 1, groundScreenY, 2, 800 - groundScreenY);

    // Draw lander at center of screen
    ctx.save();
    ctx.translate(landerScreenX, landerScreenY);
    ctx.rotate(state.angle);  // Rotate by current angle

    // Check if crashed
    const crashed = state.crashed || false;

    // Only draw RCS and throttle effects if not crashed
    if (!crashed) {
      // Draw RCS exhaust effects
      const rcsLeft = state.rcs_left || false;
      const rcsRight = state.rcs_right || false;

      if (rcsLeft) {
        // Left RCS fires from left side (pushes counterclockwise)
        const rcsLength = 8 + Math.random() * 4;
        const rcsWidth = 3;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-14, -5);  // Left side of lander
        ctx.lineTo(-14 - rcsLength, -5 - rcsWidth);
        ctx.lineTo(-14 - rcsLength, -5 + rcsWidth);
        ctx.closePath();
        ctx.fill();
      }

      if (rcsRight) {
        // Right RCS fires from right side (pushes clockwise)
        const rcsLength = 8 + Math.random() * 4;
        const rcsWidth = 3;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
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

    // Draw telemetry text
    ctx.fillStyle = "#0f0";
    ctx.font = "18px monospace";
    ctx.fillText(`X: ${state.x.toFixed(1)} m`, 20, 30);
    ctx.fillText(`Alt: ${state.y.toFixed(1)} m`, 20, 55);
    ctx.fillText(`Vx: ${state.vx.toFixed(2)} m/s`, 20, 80);
    ctx.fillText(`Vy: ${state.vy.toFixed(2)} m/s`, 20, 105);
    ctx.fillText(`Angle: ${(state.angle * 180 / Math.PI).toFixed(1)}°`, 20, 130);
    ctx.fillText(`ω: ${state.angular_velocity.toFixed(2)} rad/s`, 20, 155);
    const throttlePercent = ((state.throttle || 0) * 100).toFixed(0);
    ctx.fillText(`Throttle: ${throttlePercent}%`, 20, 180);

    // Draw fuel with color coding
    const fuelKg = state.fuel || 0;
    const fuelPercent = (fuelKg / 0.5) * 100; // 0.5 kg is max fuel
    if (fuelPercent > 30) {
      ctx.fillStyle = "#0f0";  // Green when fuel is good
    } else if (fuelPercent > 10) {
      ctx.fillStyle = "#ff0";  // Yellow when low
    } else {
      ctx.fillStyle = "#f00";  // Red when critical
    }
    ctx.fillText(`Fuel: ${fuelKg.toFixed(3)} kg (${fuelPercent.toFixed(0)}%)`, 20, 205);
  }).catch(err => {
    console.error("Error in update loop:", err);
  }).finally(() => {
    requestAnimationFrame(update);
  });
}

init();
