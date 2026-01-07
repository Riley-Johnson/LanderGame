Blockly.defineBlocksWithJsonArray([
  {
    "type": "rotate_left",
    "message0": "rotate left",
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230,
    "tooltip": "Fire RCS to rotate counterclockwise"
  },
  {
    "type": "rotate_right",
    "message0": "rotate right",
    "previousStatement": null,
    "nextStatement": null,
    "colour": 230,
    "tooltip": "Fire RCS to rotate clockwise"
  },
  {
    "type": "get_altitude",
    "message0": "altitude (m)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get current altitude in meters (0 = ground)"
  },
  {
    "type": "get_velocity",
    "message0": "vertical velocity (m/s)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get vertical velocity in m/s (positive = upward)"
  },
  {
    "type": "get_horizontal_position",
    "message0": "horizontal position (m)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get horizontal position in meters from center (0 = center)"
  },
  {
    "type": "get_horizontal_velocity",
    "message0": "horizontal velocity (m/s)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get horizontal velocity in m/s (positive = right)"
  },
  {
    "type": "get_angle",
    "message0": "angle (radians)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get current angle in radians (0 = up, + = CCW)"
  },
  {
    "type": "get_angle_degrees",
    "message0": "angle (degrees)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get current angle in degrees (0 = up, + = CCW)"
  },
  {
    "type": "get_angular_velocity",
    "message0": "angular velocity (rad/s)",
    "output": "Number",
    "colour": 120,
    "tooltip": "Get rotational speed in rad/s (+ = CCW)"
  },
  {
    "type": "wait_seconds",
    "message0": "wait %1 seconds",
    "args0": [
      {
        "type": "field_number",
        "name": "SECONDS",
        "value": 1,
        "min": 0
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 290,
    "tooltip": "Wait for specified number of seconds"
  },
  {
    "type": "is_first_timestep",
    "message0": "is first timestep",
    "output": "Boolean",
    "colour": 290,
    "tooltip": "Returns true on the first timestep only, useful for one-time initialization"
  },
  {
    "type": "get_time",
    "message0": "time (s)",
    "output": "Number",
    "colour": 290,
    "tooltip": "Get current simulation time in seconds"
  },
  {
    "type": "math_trig",
    "message0": "%1 %2",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["sin", "SIN"],
          ["cos", "COS"],
          ["tan", "TAN"]
        ]
      },
      {"type": "input_value", "name": "NUM", "check": "Number"}
    ],
    "output": "Number",
    "colour": 230,
    "tooltip": "Trigonometric functions (input in radians)"
  },
  {
    "type": "math_trig_inverse",
    "message0": "%1 %2",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["asin", "ASIN"],
          ["acos", "ACOS"],
          ["atan", "ATAN"]
        ]
      },
      {"type": "input_value", "name": "NUM", "check": "Number"}
    ],
    "output": "Number",
    "colour": 230,
    "tooltip": "Inverse trigonometric functions (output in radians)"
  },
  {
    "type": "math_atan2",
    "message0": "atan2 y: %1 x: %2",
    "args0": [
      {"type": "input_value", "name": "Y", "check": "Number"},
      {"type": "input_value", "name": "X", "check": "Number"}
    ],
    "output": "Number",
    "colour": 230,
    "tooltip": "Two-argument arctangent (returns angle in radians)"
  },
  {
    "type": "math_radians",
    "message0": "radians %1",
    "args0": [{"type": "input_value", "name": "DEG", "check": "Number"}],
    "output": "Number",
    "colour": 230,
    "tooltip": "Convert degrees to radians"
  },
  {
    "type": "math_degrees",
    "message0": "degrees %1",
    "args0": [{"type": "input_value", "name": "RAD", "check": "Number"}],
    "output": "Number",
    "colour": 230,
    "tooltip": "Convert radians to degrees"
  },
  {
    "type": "math_abs",
    "message0": "abs %1",
    "args0": [{"type": "input_value", "name": "NUM", "check": "Number"}],
    "output": "Number",
    "colour": 230,
    "tooltip": "Absolute value"
  },
  {
    "type": "math_pi",
    "message0": "π",
    "output": "Number",
    "colour": 230,
    "tooltip": "Pi constant (3.14159...)"
  }
]);

// Define throttle blocks using JavaScript API for better compatibility
Blockly.Blocks['set_throttle'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('set throttle to');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
    this.setTooltip('Set main thruster throttle (0.0 to 1.0)');
  }
};

Blockly.Blocks['get_throttle'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('throttle level');
    this.setOutput(true, 'Number');
    this.setColour(120);
    this.setTooltip('Get current throttle level (0.0 to 1.0)');
  }
};

Blockly.Python['set_throttle'] = function(block) {
  const value = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || '0';
  return 'set_throttle(' + value + ')\n';
};

Blockly.Python['get_throttle'] = function(block) {
  return ['get_throttle()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['rotate_left'] = function(block) {
  return 'rotate_left()\n';
};

Blockly.Python['rotate_right'] = function(block) {
  return 'rotate_right()\n';
};

Blockly.Python['wait_seconds'] = function(block) {
  const seconds = block.getFieldValue('SECONDS');
  return `await wait(${seconds})\n`;
};

Blockly.Python['get_altitude'] = function(block) {
  return ['get_altitude()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_velocity'] = function(block) {
  return ['get_velocity()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_horizontal_position'] = function(block) {
  return ['get_horizontal_position()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_horizontal_velocity'] = function(block) {
  return ['get_horizontal_velocity()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_angle'] = function(block) {
  return ['get_angle()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_angle_degrees'] = function(block) {
  return ['get_angle_degrees()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_angular_velocity'] = function(block) {
  return ['get_angular_velocity()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['is_first_timestep'] = function(block) {
  return ['is_first_timestep()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['get_time'] = function(block) {
  return ['get_time()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_trig'] = function(block) {
  const num = Blockly.Python.valueToCode(block, 'NUM', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  const op = block.getFieldValue('OP');
  const funcMap = {
    'SIN': 'math.sin',
    'COS': 'math.cos',
    'TAN': 'math.tan'
  };
  return [`${funcMap[op]}(${num})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_trig_inverse'] = function(block) {
  const num = Blockly.Python.valueToCode(block, 'NUM', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  const op = block.getFieldValue('OP');
  const funcMap = {
    'ASIN': 'math.asin',
    'ACOS': 'math.acos',
    'ATAN': 'math.atan'
  };
  return [`${funcMap[op]}(${num})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_atan2'] = function(block) {
  const y = Blockly.Python.valueToCode(block, 'Y', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  const x = Blockly.Python.valueToCode(block, 'X', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  return [`math.atan2(${y}, ${x})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_radians'] = function(block) {
  const deg = Blockly.Python.valueToCode(block, 'DEG', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  return [`math.radians(${deg})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_degrees'] = function(block) {
  const rad = Blockly.Python.valueToCode(block, 'RAD', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  return [`math.degrees(${rad})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_abs'] = function(block) {
  const num = Blockly.Python.valueToCode(block, 'NUM', Blockly.Python.ORDER_FUNCTION_CALL) || '0';
  return [`abs(${num})`, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_pi'] = function(block) {
  return ['math.pi', Blockly.Python.ORDER_ATOMIC];
};
