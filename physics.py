# physics.py – Realistic physics simulation with SI units
import asyncio
import math

# Physical constants (SI units)
GRAVITY = 9.8  # m/s^2
DRY_MASS = 1  # kg
FUEL_MASS = 0.5  # kg (initial fuel mass)
THRUSTER_FORCE = 50.0  # N (main engine)
RCS_TORQUE = 3.0  # N·m (rotation control torque)
MOMENT_OF_INERTIA = 1.0  # kg*m^2 (rotational inertia)
DT = 0.016  # seconds (time step, ~60 FPS)
MAX_ALTITUDE = 100.0  # meters
FUEL_CONSUMPTION_RATE = 0.15  # kg/s at full throttle

# State variables
x = 0.0  # horizontal position in meters (0 = center, positive = right)
y = 90.0  # altitude in meters (upward is positive, 0 = ground)
vx = 0.0  # horizontal velocity in m/s (positive = right)
vy = 0.0  # vertical velocity in m/s (positive = upward)
angle = 0.0  # orientation in radians (0 = pointing up, positive = counterclockwise)
angular_velocity = 0.0  # rad/s (positive = counterclockwise)
fuel = FUEL_MASS  # current fuel in kg
initial_fuel = FUEL_MASS  # initial fuel amount for percentage calculation
running = True
task = None
throttle = 0.0  # main thruster throttle level (0.0 to 1.0)
rcs_value = 0.0  # RCS control (-1.0 to 1.0, negative = CCW, positive = CW)
user_control_func = None  # User's control function to run each timestep
first_timestep = True  # Flag to track if this is the first timestep
current_time = 0.0  # Current simulation time in seconds
crashed = False  # Flag to track if lander crashed (hit ground too fast)
landed_safely = False  # Flag to track successful landing

def reset():
    global x, y, vx, vy, angle, angular_velocity, fuel, initial_fuel, running, task, throttle, rcs_value, first_timestep, current_time, crashed, landed_safely
    x = 0.0  # center horizontally (0 meters from center)
    y = 90.0  # start at 90 meters altitude
    vx = 0.0  # start with zero horizontal velocity
    vy = 0.0  # start with zero vertical velocity
    angle = 0.0  # start pointing straight up
    angular_velocity = 0.0  # not rotating
    fuel = FUEL_MASS  # reset fuel
    initial_fuel = FUEL_MASS  # reset initial fuel
    throttle = 0.0  # no thrust
    rcs_value = 0.0  # no RCS
    running = True
    first_timestep = True  # Reset first timestep flag
    current_time = 0.0  # Reset simulation time
    crashed = False
    landed_safely = False

    # Cancel previous physics loop if it exists
    if task and not task.done():
        task.cancel()

    # Start a new physics loop
    task = asyncio.create_task(step_loop())

def load_scenario(scenario_x, scenario_y, scenario_vx, scenario_vy, scenario_angle, scenario_angular_velocity, scenario_fuel=None):
    """Load a custom scenario with specific initial conditions"""
    global x, y, vx, vy, angle, angular_velocity, fuel, initial_fuel, running, task, throttle, rcs_value, first_timestep, current_time, crashed, landed_safely
    x = scenario_x
    y = scenario_y
    vx = scenario_vx
    vy = scenario_vy
    angle = scenario_angle
    angular_velocity = scenario_angular_velocity
    fuel = scenario_fuel if scenario_fuel is not None else FUEL_MASS  # Use default if not specified
    initial_fuel = fuel  # Store initial fuel for percentage calculation
    throttle = 0.0
    rcs_value = 0.0
    running = True
    first_timestep = True
    current_time = 0.0
    crashed = False
    landed_safely = False

    # Cancel previous physics loop if it exists
    if task and not task.done():
        task.cancel()

    # Start a new physics loop
    task = asyncio.create_task(step_loop())

def get_altitude():
    """Return current altitude in meters"""
    return y

def get_velocity():
    """Return current vertical velocity in m/s (positive = upward)"""
    return vy

def set_throttle(value):
    """Set the main thruster throttle level (0.0 to 1.0)"""
    global throttle
    throttle = max(0.0, min(1.0, value))  # Clamp between 0 and 1

def get_throttle():
    """Return current throttle level (0.0 to 1.0)"""
    return throttle

def fire_thruster():
    """Legacy function - sets throttle to 1.0 for this timestep (for backward compatibility)"""
    global throttle
    throttle = 1.0

def set_rcs(value):
    """Set RCS control value (-1.0 to 1.0, negative = CCW, positive = CW)"""
    global rcs_value
    rcs_value = max(-1.0, min(1.0, value))  # Clamp to [-1, 1]

def get_rcs():
    """Return current RCS control value"""
    return rcs_value

def get_angle():
    """Return current angle in radians (0 = up, positive = counterclockwise)"""
    return angle

def get_angular_velocity():
    """Return angular velocity in rad/s"""
    return angular_velocity

def is_first_timestep():
    """Return True if this is the first timestep of the simulation"""
    return first_timestep

def get_time():
    """Return current simulation time in seconds"""
    return current_time

def angle_error(target_angle, current_angle):
    """
    Calculate the shortest angular error between two angles, wrapped to (-pi, pi).
    Useful for control algorithms that need to find the shortest path between angles.

    Args:
        target_angle: desired angle in radians
        current_angle: current angle in radians

    Returns:
        error in radians, wrapped to the range (-pi, pi)
    """
    error = target_angle - current_angle
    # Wrap to (-pi, pi) range
    error = (error + math.pi) % (2 * math.pi) - math.pi
    return error

def set_control_function(func):
    """Set the user's control function to run each timestep"""
    global user_control_func
    user_control_func = func

def compute_derivatives(state, throttle_val, rcs_val, current_fuel):
    """
    Compute derivatives for RK4 integration.
    state = [x, y, vx, vy, angle, angular_velocity]
    returns [dx/dt, dy/dt, dvx/dt, dvy/dt, dangle/dt, dangular_velocity/dt]
    """
    x_s, y_s, vx_s, vy_s, angle_s, omega_s = state

    # Mass stays constant (fuel doesn't affect mass)
    current_mass = DRY_MASS

    # Calculate thrust force components (only if we have fuel)
    effective_throttle = throttle_val if current_fuel > 0 else 0.0
    thrust_x = effective_throttle * THRUSTER_FORCE * math.sin(angle_s)
    thrust_y = effective_throttle * THRUSTER_FORCE * math.cos(angle_s)

    # Translational accelerations
    ax = thrust_x / current_mass
    ay = (thrust_y / current_mass) - GRAVITY

    # Rotational acceleration (RCS: negative = CCW, positive = CW)
    angular_accel = -rcs_val * RCS_TORQUE / MOMENT_OF_INERTIA

    return [vx_s, vy_s, ax, ay, omega_s, angular_accel]

async def step_loop():
    """Runs continuously and updates physics with RK4 integration."""
    global x, y, vx, vy, angle, angular_velocity, fuel, running, throttle, rcs_value, user_control_func, first_timestep, current_time, crashed, landed_safely
    try:
        while running:
            # Run user control code if set
            if user_control_func:
                try:
                    await user_control_func()
                except Exception as e:
                    print(f"Error in user control code: {e}")
                finally:
                    if first_timestep:
                        first_timestep = False

            # Store current control inputs
            throttle_snapshot = throttle
            rcs_snapshot = rcs_value

            # Consume fuel based on throttle (only if we have fuel)
            if fuel > 0 and throttle_snapshot > 0:
                fuel_consumed = FUEL_CONSUMPTION_RATE * throttle_snapshot * DT
                fuel = max(0.0, fuel - fuel_consumed)
                if fuel == 0:
                    print("OUT OF FUEL!")

            # Current state vector
            state = [x, y, vx, vy, angle, angular_velocity]

            # RK4 integration (pass current fuel for mass calculation)
            k1 = compute_derivatives(state, throttle_snapshot, rcs_snapshot, fuel)

            state_k2 = [state[i] + k1[i] * DT / 2 for i in range(6)]
            k2 = compute_derivatives(state_k2, throttle_snapshot, rcs_snapshot, fuel)

            state_k3 = [state[i] + k2[i] * DT / 2 for i in range(6)]
            k3 = compute_derivatives(state_k3, throttle_snapshot, rcs_snapshot, fuel)

            state_k4 = [state[i] + k3[i] * DT for i in range(6)]
            k4 = compute_derivatives(state_k4, throttle_snapshot, rcs_snapshot, fuel)

            # Update state using RK4 formula
            for i in range(6):
                state[i] += (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) * DT / 6

            # Unpack state
            x, y, vx, vy, angle, angular_velocity = state

            # Update simulation time
            current_time += DT

            # Normalize angle to [-π, π]
            while angle > math.pi:
                angle -= 2 * math.pi
            while angle < -math.pi:
                angle += 2 * math.pi

            # Ground collision (y = 0 is ground level)
            if y <= 0:
                y = 0
                # Calculate total impact velocity
                total_velocity = math.sqrt(vx**2 + vy**2)

                if total_velocity > 10.0:
                    # Crashed - hit ground too fast
                    crashed = True
                    running = False
                    print(f"CRASHED at {total_velocity:.1f} m/s! (max safe landing speed: 10 m/s)")
                    print(f"Impact location: x={x:.1f}m, angle={math.degrees(angle):.1f}°")
                else:
                    # Safe landing
                    landed_safely = True
                    running = False
                    print(f"LANDED SAFELY at {total_velocity:.1f} m/s")
                    print(f"Landing location: x={x:.1f}m, angle={math.degrees(angle):.1f}°")

                vy = 0
                vx = 0
                angular_velocity = 0

            # No ceiling or horizontal boundaries - unlimited exploration!

            await asyncio.sleep(DT)
    except asyncio.CancelledError:
        print("Physics loop cancelled")
        raise

async def wait(seconds):
    await asyncio.sleep(seconds)

def get_horizontal_position():
    """Return horizontal position in meters from center"""
    return x

def get_horizontal_velocity():
    """Return horizontal velocity in m/s (positive = right)"""
    return vx

def get_fuel():
    """Return current fuel in kg"""
    return fuel

def get_state():
    """Return state for JS renderer."""
    import json
    return json.dumps({
        "x": x,
        "y": y,
        "vx": vx,
        "vy": vy,
        "angle": angle,
        "angular_velocity": angular_velocity,
        "throttle": throttle,
        "fuel": fuel,
        "initial_fuel": initial_fuel,
        "rcs_value": rcs_value,
        "crashed": crashed,
        "landed_safely": landed_safely
    })
