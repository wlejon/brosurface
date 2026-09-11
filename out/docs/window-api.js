/**
 * =============================================================================
 * bro.window & window.* — Runtime Window & Display Management
 * =============================================================================
 *
 * Runtime window state control (borderless, always-on-top, position, size limits,
 * display enumeration and placement).
 *
 * @example
 *   bro.window.borderless = true;
 *   bro.window.alwaysOnTop = true;
 *   const pos = bro.window.getPosition();
 *   console.log('Window position:', pos.x, pos.y);
 *   const displays = bro.window.getDisplays();
 *   console.log('Displays attached:', displays.length);
 */

// ── Dictionaries ─────────────────────────────────────────────────────────────

/**
 * Desktop coordinates and dimensions of a rectangle bounds.
 * @typedef {Object} DisplayBounds
 * @property {number} [x] -  X coordinate in desktop pixels.
 * @property {number} [y] -  Y coordinate in desktop pixels.
 * @property {number} [width] -  Width in desktop pixels.
 * @property {number} [height] -  Height in desktop pixels.
 */

/**
 * Display device descriptor.
 * @typedef {Object} DisplayInfo
 * @property {number} [id] -  Stable SDL display identifier.
 * @property {string} [name] -  Display device name.
 * @property {DisplayBounds} [bounds] -  Full display bounds.
 * @property {DisplayBounds} [workArea] -  Usable work area bounds minus taskbars and docks.
 * @property {number} [refreshRate] -  Refresh rate in Hz.
 * @property {number} [contentScale] -  OS content scale multiplier (1.0 = 100%).
 * @property {boolean} [isPrimary] -  Whether this is the system primary display.
 * @property {boolean} [isCurrent] -  Whether the active window currently sits on this display.
 */

/**
 * 2D desktop position.
 * @typedef {Object} WindowPosition
 * @property {number} [x] -  Desktop X coordinate.
 * @property {number} [y] -  Desktop Y coordinate.
 */

/**
 * 2D window dimensions.
 * @typedef {Object} WindowSize
 * @property {number} [width] -  Width in pixels.
 * @property {number} [height] -  Height in pixels.
 */

// ── Namespaces ───────────────────────────────────────────────────────────────

/**
 * Runtime window management namespace.
 */
/**
 * Current window display state ('normal', 'minimized', 'maximized', 'fullscreen').
 * @readonly
 * @type {string}
 */
bro.window.state;

/**
 * Whether the window has OS borders and title bar removed.
 * @type {boolean}
 */
bro.window.borderless;

/**
 * Whether the window stays pinned above standard windows.
 * @type {boolean}
 */
bro.window.alwaysOnTop;

/**
 * Minimizes the window.
 */
bro.window.minimize = function() {};

/**
 * Maximizes the window.
 */
bro.window.maximize = function() {};

/**
 * Restores the window from minimized or maximized state.
 */
bro.window.restore = function() {};

/**
 * Retrieves current desktop coordinate position of the window.
 * @returns {WindowPosition}
 */
bro.window.getPosition = function() {};

/**
 * @returns {number}
 */
bro.window.getPositionX = function() {};

/**
 * @returns {number}
 */
bro.window.getPositionY = function() {};

/**
 * @param {number} x
 * @param {number} y
 */
bro.window.setPosition = function(x, y) {};

/**
 * @returns {WindowSize}
 */
bro.window.getMinSize = function() {};

/**
 * @returns {number}
 */
bro.window.getMinWidth = function() {};

/**
 * @returns {number}
 */
bro.window.getMinHeight = function() {};

/**
 * @param {number} width
 * @param {number} height
 */
bro.window.setMinSize = function(width, height) {};

/**
 * @returns {WindowSize}
 */
bro.window.getMaxSize = function() {};

/**
 * @returns {number}
 */
bro.window.getMaxWidth = function() {};

/**
 * @returns {number}
 */
bro.window.getMaxHeight = function() {};

/**
 * @param {number} width
 * @param {number} height
 */
bro.window.setMaxSize = function(width, height) {};

/**
 * @returns {Array<DisplayInfo>}
 */
bro.window.getDisplays = function() {};

/**
 * @returns {number}
 */
bro.window.getDisplayCount = function() {};

/**
 * @param {number} id
 * @returns {boolean}
 */
bro.window.moveToDisplay = function(id) {};

