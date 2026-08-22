/**
 * tools/surfaces_core.mjs
 * Surface definitions for pilots, peripheral namespaces, and core engine subsystems.
 */

export const CORE_SURFACES = [
  // --- PILOT CANDIDATES ---
  {
    id: 'bro.noise',
    name: 'bro.noise (FastNoise)',
    category: 'Pilot Candidate (Stateless)',
    pilot: true,
    pilotRationale: 'Pure stateless math functions over typed arrays (Float32Array). Simplest marshalling contract.',
    gate: 'None',
    description: 'SIMD procedural noise generator (FastNoise2), pure stateless functions over typed arrays',
    quickjs: [{ path: 'third_party/brokit/src/api/noise.cpp' }],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/noise-api.js' }],
    ts: [],
    headless: [],
    shapes: ['typedarray (Float32Array)', 'number (float, int)', 'string (enum)', 'handle (FastNoise)'],
    tests: [
      'tests/brokit/test_noise.js',
      'tests/brokit/test_noise_extras.js',
      'tests/brokit/test_noise_position_array.js'
    ]
  },
  {
    id: 'bro.time',
    name: 'bro.time',
    category: 'Pilot Candidate (Stateful Clock)',
    pilot: true,
    pilotRationale: 'Small stateful namespace bound to one engine-owned clock. Tests scalar properties & time control.',
    gate: 'None',
    description: 'Global pause & timescale control over engine-owned scaled clock',
    quickjs: [
      { path: 'src/js/time_bindings.cpp' },
      { path: 'src/js/time_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/dom_globals.cpp', start: 818, end: 821, note: 'bro.time inline builder' }
    ],
    stubs: [],
    docs: [{ path: 'docs/time-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 162, end: 172, note: 'advanceTime / sleep' }
    ],
    shapes: ['number (now, scale, delta)', 'boolean (paused)'],
    tests: ['tests/time/test_time.js']
  },
  {
    id: 'file.blob',
    name: 'Blob / File / FileReader / URL',
    category: 'Pilot Candidate (Class / Prototype)',
    pilot: true,
    pilotRationale: 'Real classes with prototypes, instanceof, inheritance (File extends Blob), and cross-API reach. Exercises HostClass.',
    gate: 'None',
    description: 'W3C File API: in-memory binary blobs, files, FileReader event stream, object URLs',
    quickjs: [
      { path: 'third_party/brokit/src/api/blob.cpp' },
      { path: 'src/js/js/file_polyfills.js' },
      { path: 'src/js/anchor_download.cpp' },
      { path: 'src/js/anchor_download.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_file.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/file-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 622, end: 662, note: 'lastDownload, setPickedFiles, setDialogAnswer' }
    ],
    shapes: [
      'handle (HostBlob, HostReader, HostUrl)',
      'typedarray (Uint8Array, ArrayBuffer)',
      'string',
      'number',
      'dict/options ({type, lastModified})',
      'callback (EventListener, onload, onerror)',
      'promise (text(), arrayBuffer(), bytes())'
    ],
    tests: [
      'tests/brokit/test_blob.js',
      'tests/brokit/test_file.js',
      'tests/brokit/test_url.js',
      'tests/bronze_host/appdir_file/main.js',
      'tests/dom/test_anchor_download.js'
    ]
  },

  // --- PERIPHERAL / CORE DECLARATIVE NAMESPACES ---
  {
    id: 'bro.flora',
    name: 'bro.flora',
    category: 'Ecosystem Simulation',
    pilot: false,
    gate: 'BRO_WITH_FLORA',
    description: 'Procedural ecosystem simulation (plants, foliage, bloom generation and instance transforms)',
    quickjs: [
      { path: 'src/js/flora_bindings.cpp' },
      { path: 'src/js/flora_bindings.h' },
      { path: 'src/js/flora_bindings_emit.cpp' },
      { path: 'src/js/flora_bindings_internal.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 126, end: 131, gate: 'BRO_WITH_FLORA' }
    ],
    docs: [{ path: 'docs/flora-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (FloraSimulation)', 'typedarray (Float32Array)', 'vec3/vec4', 'dict/options', 'number'],
    tests: ['tests/flora/test_bindings_smoke.js']
  },
  {
    id: 'bro.math',
    name: 'bro.math',
    category: 'Math Utilities',
    pilot: false,
    gate: 'None',
    description: 'Vector / matrix / spatial acceleration utilities (SpatialHash3D, dual array/object accept)',
    quickjs: [
      { path: 'src/js/math_bindings.cpp' },
      { path: 'src/js/math_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/math-api.js' }],
    ts: [],
    headless: [],
    shapes: ['vec2/vec3/vec4 (dual accept array/object)', 'quat', 'mat4', 'handle (SpatialHash3D)', 'number'],
    tests: ['tests/math/test_spatial_hash.js', 'tests/math/test_rng_smoother.js']
  },
  {
    id: 'bro.image',
    name: 'bro.image / Image / bro.image.gpu',
    category: 'Image Processing & CPU/GPU Kernels',
    pilot: false,
    gate: 'None',
    description: 'CPU image decode/encode + processing kernels and WebGL2 GPU image pipeline',
    quickjs: [
      { path: 'src/js/image_bindings.cpp' },
      { path: 'src/js/image_bindings.h' },
      { path: 'src/js/js/image_gpu.js' },
      { path: 'third_party/brokit/src/api/image.cpp' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_image.cpp' },
      { path: 'src/bronze_host/host_element_image.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/image-api.js' }],
    ts: [],
    headless: [],
    shapes: ['typedarray (Uint8Array, Float32Array)', 'handle', 'callback', 'dict/options ({width, height, channels})', 'number'],
    tests: ['tests/image/test_image_kernels.js', 'tests/canvas/test_image_loading.js']
  },
  {
    id: 'bro.imagebitmap',
    name: 'ImageBitmap / createImageBitmap',
    category: 'Bitmap Transfer',
    pilot: false,
    gate: 'None',
    description: 'W3C ImageBitmap interface for off-thread image decoding and GPU texture upload',
    quickjs: [
      { path: 'src/js/imagebitmap_bindings.cpp' },
      { path: 'src/js/imagebitmap_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/imagebitmap-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (ImageBitmap)', 'promise', 'dict/options', 'number'],
    tests: ['tests/image/test_imagebitmap.js', 'tests/canvas/test_create_image_bitmap.js']
  },
  {
    id: 'bro.audio',
    name: 'AudioContext / broaudio',
    category: 'Real-Time Audio Graph',
    pilot: false,
    gate: 'None',
    description: 'Web Audio API graph implementation, DSP synthesis, spatial nodes, audio buses, MIDI',
    quickjs: [
      { path: 'src/js/audio_bindings.cpp' },
      { path: 'src/js/audio_bindings.h' },
      { path: 'src/js/audio_scene_sync.cpp' },
      { path: 'src/js/audio_scene_sync.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_audio_core.cpp' },
      { path: 'src/bronze_host/host_audio_nodes.cpp' },
      { path: 'src/bronze_host/host_audio_buffer.cpp' },
      { path: 'src/bronze_host/host_audio_param.cpp' },
      { path: 'src/bronze_host/host_audio_spatial.cpp' },
      { path: 'src/bronze_host/host_audio_dsp.cpp' },
      { path: 'src/bronze_host/host_audio_internal.h' }
    ],
    stubs: [],
    docs: [{ path: 'docs/audio-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (AudioContext, AudioNode, AudioParam, AudioBuffer)', 'typedarray (Float32Array)', 'vec3', 'number', 'string (enum)', 'callback/promise'],
    tests: ['tests/audio/test_context.js', 'tests/audio/test_buses.js', 'tests/audio/test_spatial.js', 'tests/bronze_host/appdir_audio/']
  },
  {
    id: 'bro.mesh',
    name: 'bro.mesh / Mesh',
    category: 'Mesh Geometry & Operations',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Procedural mesh generation, CSG boolean ops, mesh simplification, UV unwrapping, Draco codec',
    quickjs: [
      { path: 'src/js/mesh_bindings.cpp' },
      { path: 'src/js/mesh_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_codecs.cpp', note: 'Draco encode/decode bridge' }
    ],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 173, end: 177, gate: 'BRO_WITH_3D' }
    ],
    docs: [{ path: 'docs/mesh-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Mesh)', 'typedarray (Float32Array, Uint32Array)', 'vec3/vec2', 'color', 'dict/options', 'string'],
    tests: ['tests/mesh/test_analysis.js', 'tests/mesh/test_baking.js', 'tests/mesh/test_bvh.js', 'tests/bronze_host/appdir_codecs/']
  },
  {
    id: 'bro.scene',
    name: 'bro.scene (SceneGraph / Nodes)',
    category: '3D Scene Graph',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Hierarchical 3D scene graph, ShapeNode, SpriteNode, MeshNode, SplatNode, CameraNode',
    quickjs: [
      { path: 'src/js/scene_bindings.cpp' },
      { path: 'src/js/scene_bindings.h' },
      { path: 'src/js/scene_bindings_mesh.cpp' },
      { path: 'src/js/scene_bindings_view.cpp' },
      { path: 'src/js/scene_bindings_internal.h' },
      { path: 'src/js/js/impostor_layer.js' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_canvas2d.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/scene-api.js' }],
    ts: [],
    headless: [
      { path: 'src/headless/main.cpp', start: 80, end: 130, note: '__host.sceneContext, __host.sceneLink' }
    ],
    shapes: ['handle (SceneGraph, SceneNode)', 'vec2/vec3/vec4', 'quat', 'color', 'dual array/object', 'callback', 'typedarray'],
    tests: ['tests/scene/test_scenegraph.js', 'tests/scene/test_mesh_node.js', 'tests/bronze_host/appdir_instanced/']
  },
  {
    id: 'bro.animation',
    name: 'AnimationPlayer / Animation',
    category: 'Skeletal & Property Animation',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Keyframe track clips, blend spaces, layered skeletal blending, and state machines',
    quickjs: [
      { path: 'src/js/scene_bindings_anim.cpp' },
      { path: 'src/js/scene_bindings_clip.cpp' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/animation-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (AnimationPlayer, Clip, BlendSpace, StateMachine)', 'dict/options', 'vec3/quat', 'number', 'string', 'callback'],
    tests: ['tests/scene/test_animation_clips.js', 'tests/scene/test_blend_spaces.js', 'tests/scene/test_anim_state_machine.js']
  },
  {
    id: 'bro.lighting',
    name: 'PBR Lighting & Materials',
    category: '3D Rendering / Shading',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'PBR lighting pipeline: LightNode (directional, point, spot), PBRMaterial, tonemapping, ambient',
    quickjs: [
      { path: 'src/js/scene_bindings_fx.cpp' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/lighting-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (LightNode, Material)', 'vec3/color', 'number', 'string/enum'],
    tests: ['tests/scene/test_pbr_materials.js', 'tests/scene/test_lighting.js']
  },
  {
    id: 'bro.net',
    name: 'bro.net',
    category: 'Low-Level Networking',
    pilot: false,
    gate: 'BRO_WITH_NET',
    description: 'Game networking over GameNetworkingSockets (host/connect, message channels, reliable/unreliable)',
    quickjs: [
      { path: 'src/js/net_bindings.cpp' },
      { path: 'src/js/net_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_net.cpp' }
    ],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 137, end: 145, gate: 'BRO_WITH_NET' }
    ],
    docs: [{ path: 'docs/net-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (NetPeer, Host, Client)', 'typedarray (Uint8Array)', 'string', 'number', 'callback (onMessage, onConnect)', 'dict/options'],
    tests: ['tests/net/test_net_loopback.js', 'tests/net/test_net_channels_clone.js', 'tests/bronze_host/appdir_net/']
  },
  {
    id: 'bro.net.sync',
    name: 'bro.net.sync',
    category: 'High-Level Replication',
    pilot: false,
    gate: 'BRO_WITH_NET',
    description: 'Entity state replication, RPC dispatcher, star-topology host replication engine',
    quickjs: [
      { path: 'src/js/js/net_sync.js' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/net-sync-api.js' }],
    ts: [],
    headless: [],
    shapes: ['object', 'string', 'number', 'callback'],
    tests: ['tests/net/test_net_sync.js']
  },
  {
    id: 'gamepad',
    name: 'Gamepad API',
    category: 'Input Hardware',
    pilot: false,
    gate: 'None',
    description: 'W3C Gamepad API, dual-motor rumble, settings action bindings, headless virtual gamepad injection',
    quickjs: [
      { path: 'src/js/gamepad_bindings.cpp' },
      { path: 'src/js/gamepad_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/dom_gamepad.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/gamepad-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 757, end: 810, note: 'gamepadConnect, gamepadDisconnect, gamepadButton, gamepadAxis' }
    ],
    shapes: ['dict/options (Gamepad, GamepadButton)', 'number (axes, rumble)', 'string', 'callback'],
    tests: ['tests/gamepad/test_gamepad.js', 'tests/bronze_host/appdir_input/']
  },
  {
    id: 'events.pointer',
    name: 'Pointer / Touch Events',
    category: 'Input Events & Dispatch',
    pilot: false,
    gate: 'None',
    description: 'W3C Pointer & Touch events, 3-phase DOM event dispatch, pointer capture, compat mouse synthesis',
    quickjs: [
      { path: 'src/js/event_bindings.cpp' },
      { path: 'src/js/event_dispatch.cpp' },
      { path: 'src/js/event_dispatch_populate.cpp' },
      { path: 'src/js/event_dispatch_invoke.cpp' },
      { path: 'src/js/event_dispatch.h' },
      { path: 'src/js/event_dispatch_internal.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_events.cpp' },
      { path: 'src/bronze_host/host_dom_events.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/pointer-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 256, end: 532, note: 'mouse, touch, key, IME simulation' }
    ],
    shapes: ['handle/object (Event subclasses)', 'number', 'string', 'boolean', 'callback (event listeners)'],
    tests: ['tests/events/test_add_remove_listener.js', 'tests/touch/test_touch_gesture.js', 'tests/bronze_host/appdir_events/']
  },
  {
    id: 'web.animations',
    name: 'element.animate() (WAAPI)',
    category: 'DOM Animation',
    pilot: false,
    gate: 'None',
    description: 'Web Animations API subset running over CSS-transition interpolator engine',
    quickjs: [
      { path: 'src/js/web_animation_bindings.cpp' },
      { path: 'src/js/web_animation_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/web-animations-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Animation)', 'array of keyframe objects', 'dict/options (timing)', 'number', 'callback', 'promise'],
    tests: ['tests/dom/test_web_animations.js']
  },
  {
    id: 'matchmedia',
    name: 'window.matchMedia()',
    category: 'CSS Media Queries',
    pilot: false,
    gate: 'None',
    description: 'MediaQueryList evaluation, live change listeners, per-realm media query resolution',
    quickjs: [
      { path: 'src/js/matchmedia_bindings.cpp' },
      { path: 'src/js/matchmedia_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/dom_globals.cpp', start: 643, end: 656, note: 'matchMedia inline implementation' }
    ],
    stubs: [],
    docs: [{ path: 'docs/matchmedia-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle/object (MediaQueryList)', 'string (query)', 'boolean (matches)', 'callback'],
    tests: ['tests/dom/test_match_media.js']
  },
  {
    id: 'bro.window',
    name: 'bro.window / window.*',
    category: 'Window & Display Management',
    pilot: false,
    gate: 'None',
    description: 'Runtime OS window control (borderless, always-on-top, limits, multi-window open), screen, battery',
    quickjs: [
      { path: 'src/js/window_bindings.cpp' },
      { path: 'src/js/window_bindings.h' },
      { path: 'src/js/window_host_bindings.cpp' },
      { path: 'src/js/window_host_bindings.h' },
      { path: 'src/js/js/window_polyfill.js' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_platform.cpp' },
      { path: 'src/bronze_host/dom_globals.cpp', start: 565, end: 696, note: 'makeWindowValue' }
    ],
    stubs: [],
    docs: [{ path: 'docs/window-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 236, end: 255, note: 'argWindowId routing' }
    ],
    shapes: ['dict/options (Display, BatteryManager, WindowHandle)', 'number', 'string', 'boolean', 'callback/events'],
    tests: ['tests/window/test_battery.js', 'tests/manual/multiwindow_demo/']
  },
  {
    id: 'dialogs',
    name: 'Native Dialogs',
    category: 'Modal Dialogs',
    pilot: false,
    gate: 'None',
    description: 'Native modal file/folder pickers, alert/confirm/prompt modal dialogs',
    quickjs: [
      { path: 'src/js/dialog_bindings.cpp' },
      { path: 'src/js/dialog_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_platform.cpp', start: 101, end: 200, note: 'alert/confirm/prompt' }
    ],
    stubs: [],
    docs: [{ path: 'docs/dialogs-api.js' }],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 658, end: 662, note: 'setDialogAnswer' }
    ],
    shapes: ['string (paths, text)', 'boolean', 'dict/options (file filters)', 'callback/promise'],
    tests: ['tests/dom/test_dialogs.js']
  },
  {
    id: 'bro.menu',
    name: 'bro.menu',
    category: 'Native Menu Bar',
    pilot: false,
    gate: 'None',
    description: 'OS native top menu bar management (items, submenus, accelerators, action events)',
    quickjs: [
      { path: 'src/js/menu_bindings.cpp' },
      { path: 'src/js/menu_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/dom_globals.cpp', start: 812, end: 816, note: 'bro.menu builder' }
    ],
    stubs: [],
    docs: [{ path: 'docs/menu-api.js' }],
    ts: [],
    headless: [],
    shapes: ['array/object of menu items ({id, label, accel, children})', 'string', 'callback (onAction)'],
    tests: ['tests/engine/test_menu.js']
  },
  {
    id: 'bro.gizmo',
    name: 'bro.gizmo',
    category: '3D Gizmo Controls',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: '3D transform handles (translation, rotation, scale) with mouse picking and manipulation',
    quickjs: [
      { path: 'src/js/gizmo_bindings.cpp' },
      { path: 'src/js/gizmo_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/gizmo-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Gizmo)', 'vec3/quat', 'color', 'string (mode)', 'callback (onTransform)', 'number'],
    tests: ['tests/scene/test_gizmo.js']
  },
  {
    id: 'video',
    name: 'Video / VideoEncoder / GifEncoder / bro.media',
    category: 'Media & Codecs',
    pilot: false,
    gate: 'BRO_WITH_VIDEO',
    description: 'HTMLMediaElement video playback (VP9/Opus), WebM/GIF video encoding, media waveform & filmstrip analysis',
    quickjs: [
      { path: 'src/js/video_bindings.cpp' },
      { path: 'src/js/video_bindings.h' },
      { path: 'src/js/media_bindings.cpp' },
      { path: 'src/js/media_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_video.cpp' }
    ],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 151, end: 154, gate: 'BRO_WITH_VIDEO' }
    ],
    docs: [{ path: 'docs/video-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (VideoEncoder, GifEncoder, VideoPlayer)', 'typedarray (RGBA pixels, waveform floats)', 'promise', 'dict/options (codec config, filmstrip)', 'number', 'string', 'callback'],
    tests: ['tests/video/test_encoders.js', 'tests/video/test_audio_only.js', 'tests/bronze_host/appdir_video/']
  },
  {
    id: 'iframe',
    name: 'IFrame (<iframe src>)',
    category: 'Sub-Document Isolation',
    pilot: false,
    gate: 'None',
    description: 'Isolated sub-document realm with independent DOM, styles, timers, and input routing',
    quickjs: [
      { path: 'src/js/dom_bindings.cpp', start: 400, end: 500, note: 'iframe binding slice' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/iframe-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Element, Document)', 'string (src, origin)', 'callback/events'],
    tests: ['tests/dom/test_iframe.js', 'tests/test_app/iframe_child/']
  },
  {
    id: 'bro.steam',
    name: 'bro.steam',
    category: 'Platform / Steamworks',
    pilot: false,
    gate: 'BRO_WITH_STEAM',
    description: 'Steamworks SDK runtime bindings (stats, achievements, overlay, auth)',
    quickjs: [
      { path: 'src/js/steam_bindings.cpp' },
      { path: 'src/js/steam_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['dict/options', 'string', 'number', 'boolean', 'callback'],
    tests: ['tests/engine/test_steam.js']
  },
  {
    id: 'bro.text',
    name: 'bro.text',
    category: 'Typography & Text Diagnostics',
    pilot: false,
    gate: 'BRO_WITH_TEXT_SHAPING',
    description: 'HarfBuzz cluster map diagnostics, shaped runs, bidi levels, glyph metrics',
    quickjs: [
      { path: 'src/js/text_bindings.cpp' },
      { path: 'src/js/text_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['string (text)', 'object (clusters, glyphs, advance, bidi runs)', 'number'],
    tests: ['tests/style/test_caret_clusters.js', 'tests/layout/test_bidi_conformance.js']
  },
  {
    id: 'rigging',
    name: 'Rig / IK',
    category: 'Rigging & Inverse Kinematics',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Skeleton rig hierarchy, bone constraints, two-bone / FABRIK inverse kinematics solvers',
    quickjs: [
      { path: 'src/js/rigging_bindings.cpp' },
      { path: 'src/js/rigging_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['handle (Rig, Skeleton, IKSolver)', 'vec3/quat', 'typedarray', 'dict/options', 'number'],
    tests: ['tests/rigging/probe_meshy.js', 'tests/rigging/diag_autorig_locomotion.js']
  },
  {
    id: 'bro.server',
    name: 'bro.server',
    category: 'Dedicated Server Host',
    pilot: false,
    gate: 'None',
    description: 'Dedicated headless server runtime control, fixed-tickrate loop lifecycle',
    quickjs: [
      { path: 'src/js/server_bindings.cpp' },
      { path: 'src/js/server_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['number (tickrate, uptime)', 'callback (tick loop)', 'dict/options'],
    tests: ['tests/manual/net_roundtrip.js']
  },
  {
    id: 'bro.settings',
    name: 'bro.settings',
    category: 'Settings Management',
    pilot: false,
    gate: 'None',
    description: 'Three-layer configuration hierarchy (engine < app < user), persistent .bro_settings.json',
    quickjs: [
      { path: 'src/js/settings_bindings.cpp' },
      { path: 'src/js/settings_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/settings.md' }],
    ts: [],
    headless: [],
    shapes: ['dict/options (categories, keys/values)', 'string', 'number', 'boolean', 'callback (change listener)'],
    tests: ['tests/settings/test_settings.js', 'tests/settings/test_action_bindings.js']
  }
];
