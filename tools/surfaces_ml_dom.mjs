/**
 * tools/surfaces_ml_dom.mjs
 * Surface definitions for AI/ML tower, physics, and web/DOM interfaces.
 */

export const ML_DOM_SURFACES = [
  // --- AUDIO ML / STREAMING SPEECH ---
  {
    id: 'bro.wake',
    name: 'bro.wake',
    category: 'Audio ML / Wake-Word',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Streaming neural wake-word detection pipeline with AGC audio tap',
    quickjs: [
      { path: 'src/js/wake_bindings.cpp' },
      { path: 'src/js/wake_bindings.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 108, end: 110, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/wake-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (WakeDetector)', 'typedarray (Float32Array)', 'number', 'callback (onWake)', 'dict/options'],
    tests: ['tests/audio/test_wake.js']
  },
  {
    id: 'bro.kws',
    name: 'bro.kws',
    category: 'Audio ML / Keyword Spotting',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Open-vocabulary streaming keyword spotting using shared ListenBus PhonemeNet features',
    quickjs: [
      { path: 'src/js/kws_bindings.cpp' },
      { path: 'src/js/kws_bindings.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 111, end: 113, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/kws-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (KwsDetector)', 'string (keywords)', 'typedarray (Float32Array)', 'number', 'callback (onSpot)', 'dict/options'],
    tests: ['tests/audio/test_kws.js']
  },
  {
    id: 'bro.mic',
    name: 'bro.mic',
    category: 'Audio Capture',
    pilot: false,
    gate: 'None',
    description: 'Live microphone capture with chunk callback, peak/RMS measurement, resampling and AGC',
    quickjs: [
      { path: 'src/js/mic_bindings.cpp' },
      { path: 'src/js/mic_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/mic-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (MicTap)', 'typedarray (Float32Array)', 'number', 'callback (onData)', 'dict/options ({peak, rms})'],
    tests: ['tests/audio/test_mic_chunks.js']
  },
  {
    id: 'bro.sense',
    name: 'bro.sense',
    category: 'Audio Sensor Hub',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Model-free acoustic sensors: VAD, spectral onset detector, tonality & pitch tracking',
    quickjs: [
      { path: 'src/js/sense_bindings.cpp' },
      { path: 'src/js/sense_bindings.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 114, end: 116, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/sense-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (SensorHub)', 'number', 'boolean', 'dict/options ({vad, onset, pitch, tonality})', 'callback'],
    tests: ['tests/audio/test_sense.js']
  },
  {
    id: 'bro.gesture',
    name: 'bro.gesture',
    category: 'Audio Gesture Matching',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Non-speech acoustic gesture pattern matcher (rhythm and tonal frequency patterns)',
    quickjs: [
      { path: 'src/js/gesture_bindings.cpp' },
      { path: 'src/js/gesture_bindings.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 117, end: 119, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/gesture-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (GestureMatcher)', 'string (pattern)', 'number', 'callback (onMatch)', 'dict/options'],
    tests: ['tests/audio/test_gesture.js']
  },
  {
    id: 'bro.listen',
    name: 'bro.listen',
    category: 'Audio Stream Multiplexing',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'N concurrent unmixed audio streams (mic, system loopback) with sensor/kws/wake attach',
    quickjs: [
      { path: 'src/js/listen_bindings.cpp' },
      { path: 'src/js/listen_bindings.h' },
      { path: 'src/js/listen_host.cpp' },
      { path: 'src/js/listen_host.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 120, end: 122, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/listen-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (ListenStream)', 'number', 'string', 'callback', 'dict/options'],
    tests: ['tests/audio/test_listen.js']
  },

  // --- THREADING / WORKERS ---
  {
    id: 'worker',
    name: 'Worker',
    category: 'Threading & Concurrency',
    pilot: false,
    gate: 'None',
    description: 'W3C Web Workers with structured clone, ArrayBuffer transfer, and realm isolation',
    quickjs: [
      { path: 'src/js/worker.cpp' },
      { path: 'src/js/worker.h' },
      { path: 'src/js/message_serializer.cpp' },
      { path: 'src/js/message_serializer.h' },
      { path: 'src/js/message_queue.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/worker-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Worker)', 'structured clone (objects, typed arrays, ArrayBuffer transfer)', 'callback (onmessage, onerror)', 'string'],
    tests: ['tests/workers/test_basic.js', 'tests/workers/test_event_loop.js']
  },

  // --- GAME AI / NAVMESH / AGENTS ---
  {
    id: 'bro.ai.game',
    name: 'bro.ai (Game AI / NavMesh / MCTS)',
    category: 'Game AI & Pathfinding',
    pilot: false,
    gate: 'BRO_WITH_GAMEAI',
    description: 'Game AI engine: NavMesh, 2D/3D NavGrid, crowd steering, perception, generic MCTS, NN learn',
    quickjs: [
      { path: 'src/js/ai_bindings.cpp' },
      { path: 'src/js/ai_bindings.h' },
      { path: 'src/js/ai_binding_integration.cpp' },
      { path: 'src/js/ai_nn_bindings.cpp' },
      { path: 'src/js/ai_learn_bindings.cpp' },
      { path: 'src/js/ai_belief_bindings.cpp' },
      { path: 'src/js/ai_extras_bindings.cpp' },
      { path: 'src/js/ai_generic_mcts_bindings.cpp' },
      { path: 'src/js/ai_grid_bindings.cpp' },
      { path: 'src/js/ai_parallel_bindings.cpp' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_ai_core.cpp' },
      { path: 'src/bronze_host/host_ai_navgrid.cpp' },
      { path: 'src/bronze_host/host_ai_navmesh.cpp' },
      { path: 'src/bronze_host/host_ai_agent.cpp' },
      { path: 'src/bronze_host/host_ai_internal.h' }
    ],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 161, end: 167, gate: 'BRO_WITH_GAMEAI' },
      { path: 'src/js/feature_stubs.cpp', start: 198, end: 206, gate: 'BRO_WITH_GAMEAI_NN' }
    ],
    docs: [{ path: 'docs/ai-game-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (NavMesh, NavGrid, Agent, MCTS, Prior, Evaluator)', 'vec2/vec3', 'typedarray (Float32Array)', 'dict/options', 'callback', 'number'],
    tests: ['tests/aigame/test_agent_groundfollow.js', 'tests/aigame/test_navmesh.js', 'tests/bronze_host/appdir_ai/']
  },

  // --- RUNTIME PROBES & SYSTEM PATHS ---
  {
    id: 'bro.gpu',
    name: 'bro.gpu',
    category: 'System / Device Probe',
    pilot: false,
    gate: 'BRO_WITH_TENSOR',
    description: 'Hardware acceleration probe (CUDA/CPU backend availability, device count, memory info)',
    quickjs: [
      { path: 'src/js/gpu_bindings.cpp' },
      { path: 'src/js/gpu_bindings.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 59, end: 74, gate: 'BRO_WITH_TENSOR' }
    ],
    docs: [{ path: 'docs/gpu-api.js' }],
    ts: [],
    headless: [],
    shapes: ['dict/options ({available, backend, devices, compiledBackends})', 'string', 'number', 'boolean'],
    tests: ['tests/gpu/test_gpu_binding.js']
  },
  {
    id: 'bro.paths',
    name: 'bro.appDir / bro.resolvePath',
    category: 'Filesystem Path Resolution',
    pilot: false,
    gate: 'None',
    description: 'Resolves real filesystem paths for sidecar binaries, external CLI tools, and app asset mounts',
    quickjs: [
      { path: 'src/js/asset_path.cpp' },
      { path: 'src/js/asset_path.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_platform.cpp', start: 1, end: 100, note: 'resolvePath bridge' }
    ],
    stubs: [],
    docs: [{ path: 'docs/paths-api.js' }],
    ts: [],
    headless: [],
    shapes: ['string (file paths)'],
    tests: ['tests/headless/test_app_paths.js']
  },

  // --- MACHINE LEARNING TOWER ---
  {
    id: 'bro.tensor',
    name: 'bro.tensor',
    category: 'Machine Learning / Tensor Engine',
    pilot: false,
    gate: 'BRO_WITH_TENSOR',
    description: 'GPU-accelerated tensor manipulation: matmul, convolutions, attention, activations, safetensors IO',
    quickjs: [
      { path: 'src/js/tensor_bindings.cpp' },
      { path: 'src/js/tensor_bindings_activations.cpp' },
      { path: 'src/js/tensor_bindings_attention.cpp' },
      { path: 'src/js/tensor_bindings_audio.cpp' },
      { path: 'src/js/tensor_bindings_conv.cpp' },
      { path: 'src/js/tensor_bindings_diffusion.cpp' },
      { path: 'src/js/tensor_bindings_int8.cpp' },
      { path: 'src/js/tensor_bindings_safetensors.cpp' },
      { path: 'src/js/tensor_bindings_internal.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 56, end: 58, gate: 'BRO_WITH_TENSOR' }
    ],
    docs: [{ path: 'docs/tensor-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Tensor)', 'typedarray (Float32Array, Int32Array, Uint8Array)', 'array of dims/shape', 'number', 'string (dtype, device)', 'dict/options'],
    tests: ['tests/tensor/test_tensor_binding.js']
  },
  {
    id: 'bro.diffusion',
    name: 'bro.diffusion',
    category: 'Machine Learning / Generative Vision',
    pilot: false,
    gate: 'BRO_WITH_DIFFUSION',
    description: 'Diffusion text-to-image pipeline: U-Net / DiT / VAE step execution, LoRA loading, attention tracing',
    quickjs: [
      { path: 'src/js/diffusion_bindings.cpp' },
      { path: 'src/js/diffusion_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 86, end: 88, gate: 'BRO_WITH_DIFFUSION' }
    ],
    docs: [{ path: 'docs/diffusion-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (DiffusionPipeline)', 'promise', 'dict/options (step options, LoRA)', 'typedarray (latents, images)', 'string', 'number', 'callback (progress)'],
    tests: ['tests/diffusion/test_diffusion_binding.js']
  },
  {
    id: 'bro.lm',
    name: 'bro.lm (Large Language Models)',
    category: 'Machine Learning / LLMs',
    pilot: false,
    gate: 'BRO_WITH_LM',
    description: 'LLM inference engine: token generation, streaming callbacks, chat templates, sampling parameters',
    quickjs: [
      { path: 'src/js/lm_bindings.cpp' },
      { path: 'src/js/lm_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 78, end: 82, gate: 'BRO_WITH_LM' }
    ],
    docs: [{ path: 'docs/lm-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (LanguageModel, Tokenizer)', 'promise', 'string', 'typedarray', 'dict/options', 'callback (stream tokens)', 'number'],
    tests: ['tests/lm/test_lm_binding.js']
  },
  {
    id: 'bro.stt',
    name: 'bro.stt',
    category: 'Machine Learning / Speech-to-Text',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Whisper / Parakeet / Qwen3-ASR speech recognition inference with word-level timestamps',
    quickjs: [
      { path: 'src/js/stt_bindings.cpp' },
      { path: 'src/js/stt_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 104, end: 104, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/stt-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (STTModel)', 'promise', 'typedarray (Float32Array PCM)', 'string', 'dict/options (timestamps, segments)', 'callback'],
    tests: ['tests/stt/test_stt_binding.js']
  },
  {
    id: 'bro.diar',
    name: 'bro.diar',
    category: 'Machine Learning / Diarization',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Streaming Sortformer & ClusterDiarizer speaker diarization and voice clustering',
    quickjs: [
      { path: 'src/js/diar_bindings.cpp' },
      { path: 'src/js/diar_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 106, end: 106, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/diar-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Diarizer)', 'promise', 'typedarray (Float32Array PCM)', 'dict/options (speakers, segments)', 'callback'],
    tests: ['tests/diar/test_diar_binding.js']
  },
  {
    id: 'bro.tts',
    name: 'bro.tts',
    category: 'Machine Learning / Text-to-Speech',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'Kokoro (phoneme) & Qwen3-TTS neural text-to-speech generation to 24 kHz PCM audio',
    quickjs: [
      { path: 'src/js/tts_bindings.cpp' },
      { path: 'src/js/tts_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 105, end: 105, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/tts-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (TTSModel)', 'promise', 'string (text, voice)', 'typedarray (Float32Array PCM)', 'dict/options', 'callback (stream PCM)'],
    tests: ['tests/tts/test_tts_binding.js']
  },
  {
    id: 'bro.rave',
    name: 'bro.rave',
    category: 'Machine Learning / Audio Neural Codec',
    pilot: false,
    gate: 'BRO_WITH_SOUNDML',
    description: 'RAVE neural audio autoencoder for real-time latent audio representation and editing',
    quickjs: [
      { path: 'src/js/rave_bindings.cpp' },
      { path: 'src/js/rave_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 107, end: 107, gate: 'BRO_WITH_SOUNDML' }
    ],
    docs: [{ path: 'docs/rave-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (RaveModel)', 'promise', 'typedarray (Float32Array PCM, latents)', 'dict/options'],
    tests: ['tests/rave/test_rave_binding.js']
  },
  {
    id: 'bro.vision',
    name: 'bro.vision',
    category: 'Machine Learning / Vision AI',
    pilot: false,
    gate: 'BRO_WITH_VISION',
    description: 'Vision models: Segment Anything (SAM), Depth Anything V2, DSINE surface normals, BiRefNet matting',
    quickjs: [
      { path: 'src/js/vision_bindings.cpp' },
      { path: 'src/js/vision_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 97, end: 100, gate: 'BRO_WITH_VISION' }
    ],
    docs: [{ path: 'docs/vision-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (VisionModel)', 'promise', 'typedarray (Uint8Array, Float32Array)', 'dict/options (points, boxes, masks)', 'number'],
    tests: ['tests/vision/test_vision_binding.js']
  },
  {
    id: 'bro.triposplat',
    name: 'bro.triposplat',
    category: 'Machine Learning / 3D Gaussian Splatting',
    pilot: false,
    gate: 'BRO_WITH_TRIPOSPLAT',
    description: 'Single-image to 3D Gaussian splat generation',
    quickjs: [
      { path: 'src/js/triposplat_bindings.cpp' },
      { path: 'src/js/triposplat_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 180, end: 183, gate: 'BRO_WITH_TRIPOSPLAT' }
    ],
    docs: [{ path: 'docs/triposplat-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (TripoSplatModel)', 'promise', 'typedarray (image buffer in, splat buffer out)', 'dict/options'],
    tests: ['tests/triposplat/test_triposplat_binding.js']
  },
  {
    id: 'bro.worldgen',
    name: 'bro.worldgen',
    category: 'Machine Learning / Learned Terrain',
    pilot: false,
    gate: 'BRO_WITH_DIFFUSION',
    description: 'Learned neural elevation field terrain generation',
    quickjs: [
      { path: 'src/js/worldgen_bindings.cpp' },
      { path: 'src/js/worldgen_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 89, end: 93, gate: 'BRO_WITH_DIFFUSION' }
    ],
    docs: [{ path: 'docs/worldgen-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (WorldgenModel)', 'promise', 'typedarray (Float32Array elevation)', 'number (coords, seed)', 'dict/options'],
    tests: ['tests/worldgen/test_worldgen_stage.js']
  },
  {
    id: 'bro.motion',
    name: 'bro.motion',
    category: 'Machine Learning / Motion Generation',
    pilot: false,
    gate: 'BRO_WITH_DIFFUSION && BRO_WITH_LM',
    description: 'ARDY text-to-motion generative model for humanoid skeletal joint animation',
    quickjs: [
      { path: 'src/js/motion_bindings.cpp' },
      { path: 'src/js/motion_bindings.h' },
      { path: 'src/js/async_job.cpp' },
      { path: 'src/js/async_job.h' }
    ],
    bronze_host: [],
    stubs: [
      { path: 'src/js/feature_stubs.cpp', start: 187, end: 192, gate: 'BRO_WITH_DIFFUSION && BRO_WITH_LM' }
    ],
    docs: [{ path: 'docs/motion-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (MotionModel)', 'promise', 'string (prompt)', 'typedarray (Float32Array joint angles)', 'dict/options'],
    tests: ['tests/motion/test_motion_binding.js']
  },

  // --- PHYSICS ENGINE ---
  {
    id: 'physics',
    name: 'Physics (Jolt Physics)',
    category: 'Rigid Body Physics',
    pilot: false,
    gate: 'BRO_WITH_PHYSICS',
    description: 'Jolt physics: rigid bodies, collision shapes, raycasts, contact callbacks, character controller, vehicles',
    quickjs: [
      { path: 'src/js/physics_bindings.cpp' },
      { path: 'src/js/physics_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_physics_core.cpp' },
      { path: 'src/bronze_host/host_physics_constraints.cpp' },
      { path: 'src/bronze_host/host_physics_character.cpp' },
      { path: 'src/bronze_host/host_physics_softbody.cpp' },
      { path: 'src/bronze_host/host_physics_queries.cpp' },
      { path: 'src/bronze_host/host_physics_internal.h' }
    ],
    stubs: [],
    docs: [{ path: 'docs/physics-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Body, Shape, World, Character, Constraint, SoftBody)', 'vec3/quat', 'color', 'dual array/object', 'callback (contacts)', 'dict/options (raycast, body config)', 'typedarray'],
    tests: ['tests/physics/test_character.js', 'tests/physics/test_body_props.js', 'tests/bronze_host/appdir_physics/']
  },

  // --- TERRAIN & TILES ---
  {
    id: 'terrain',
    name: 'scene.createTerrain',
    category: 'Heightfield Terrain',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Chunked height-field terrain streaming, procedural height generator, surface edits, raycast',
    quickjs: [
      { path: 'src/js/terrain_bindings.cpp' },
      { path: 'src/js/terrain_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/terrain-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Terrain)', 'typedarray (Float32Array heights, edits)', 'vec3', 'dict/options', 'number'],
    tests: ['tests/scene/test_terrain.js']
  },
  {
    id: 'clipmap',
    name: 'scene.createClipmapTerrain',
    category: 'GPU Clipmap Terrain',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Camera-centered GPU clipmap terrain with concentric ring meshes and streamed height pyramids',
    quickjs: [
      { path: 'src/js/clipmap_bindings.cpp' },
      { path: 'src/js/clipmap_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/clipmap-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (ClipmapTerrain)', 'dict/options (pyramid, rings)', 'vec3', 'number'],
    tests: ['tests/scene/test_clipmap.js']
  },
  {
    id: 'tileworld',
    name: 'scene.createTileWorld',
    category: 'Tile World & Meshing',
    pilot: false,
    gate: 'BRO_WITH_3D',
    description: 'Hexagonal and square tile-grid meshing, multi-layer elevation, cliffs, ambient occlusion',
    quickjs: [
      { path: 'src/js/tile_bindings.cpp' },
      { path: 'src/js/tile_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/tile-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (TileWorld)', 'typedarray (tile buffers)', 'vec3', 'dict/options', 'number'],
    tests: ['tests/scene/test_tile_world.js']
  },

  // --- WEB CORE COMPATIBILITY SURFACES ---
  {
    id: 'canvas2d',
    name: 'Canvas 2D Context',
    category: '2D Graphics Rendering',
    pilot: false,
    gate: 'None',
    description: 'W3C HTML Canvas 2D rendering context, path drawing, image rasterization, gradients',
    quickjs: [
      { path: 'src/js/canvas_bindings.cpp' },
      { path: 'src/js/canvas_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_canvas2d.cpp' },
      { path: 'src/bronze_host/host_canvas2d.h' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [
      { path: 'src/js/headless_bindings.cpp', start: 109, end: 160, note: 'screenshotCanvas' }
    ],
    shapes: ['handle (CanvasRenderingContext2D, CanvasGradient, ImageData)', 'typedarray (Uint8ClampedArray)', 'color', 'number', 'string', 'dict/options'],
    tests: ['tests/canvas/test_canvas2d.js', 'tests/canvas/test_canvas_advanced.js', 'tests/bronze_host/appdir_dom/']
  },
  {
    id: 'webgl2',
    name: 'WebGL2RenderingContext',
    category: 'GPU 3D Pipeline',
    pilot: false,
    gate: 'None',
    description: 'WebGL 2.0 (OpenGL 3.3 Core via glad) rendering context, shaders, buffers, VAOs, textures, FBOs',
    quickjs: [
      { path: 'src/js/webgl2_bindings.cpp' },
      { path: 'src/js/webgl2_bindings_state.cpp' },
      { path: 'src/js/webgl2_bindings_buffers.cpp' },
      { path: 'src/js/webgl2_bindings_shaders.cpp' },
      { path: 'src/js/webgl2_bindings_textures.cpp' },
      { path: 'src/js/webgl2_bindings_framebuffers.cpp' },
      { path: 'src/js/webgl2_bindings_queries.cpp' },
      { path: 'src/js/webgl2_bindings_objects.cpp' },
      { path: 'src/js/webgl2_bindings.h' },
      { path: 'src/js/webgl2_bindings_util.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/gl_constants.cpp' },
      { path: 'src/bronze_host/gl_state.cpp' },
      { path: 'src/bronze_host/gl_buffers.cpp' },
      { path: 'src/bronze_host/gl_shaders.cpp' },
      { path: 'src/bronze_host/gl_textures.cpp' },
      { path: 'src/bronze_host/gl_framebuffers.cpp' },
      { path: 'src/bronze_host/gl_queries.cpp' },
      { path: 'src/bronze_host/gl_context.cpp' },
      { path: 'src/bronze_host/gl_profile.cpp' },
      { path: 'src/bronze_host/gl_profile.h' },
      { path: 'src/bronze_host/gl_internal.h' }
    ],
    stubs: [],
    docs: [{ path: 'docs/headless.md', start: 1, end: 100, note: 'WebGL2 support matrix' }],
    ts: [],
    headless: [],
    shapes: ['handle (WebGLBuffer, WebGLShader, WebGLProgram, WebGLTexture, WebGLFramebuffer, WebGLVAO)', 'typedarray (all TypedArrays)', 'number (enums, sizes)', 'string (GLSL source)', 'boolean'],
    tests: ['tests/webgl/test_webgl_basic.js', 'tests/webgl/test_webgl_buffers.js', 'tests/bronze_host/appdir_instanced/', 'tests/bronze_host/appdir_pixi/']
  },
  {
    id: 'customelements',
    name: 'customElements',
    category: 'Web Components',
    pilot: false,
    gate: 'None',
    description: 'Custom element registry (customElements.define, lifecycle callbacks, observedAttributes)',
    quickjs: [
      { path: 'src/js/custom_elements.cpp' },
      { path: 'src/js/custom_elements.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['string (tag name)', 'class constructor callback (define)', 'dict/options'],
    tests: ['tests/custom_elements/test_define.js', 'tests/custom_elements/test_attributes.js']
  },
  {
    id: 'observers',
    name: 'MutationObserver / ResizeObserver',
    category: 'DOM Observers',
    pilot: false,
    gate: 'None',
    description: 'W3C DOM MutationObserver and ResizeObserver interfaces with microtask batching',
    quickjs: [
      { path: 'src/js/mutation_observer.cpp' },
      { path: 'src/js/js/observer_polyfills.js' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_observers.cpp' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['handle (Observer)', 'callback', 'array of record objects ({type, target, addedNodes, removedNodes, contentRect})', 'element handle'],
    tests: ['tests/dom/test_mutation_observer.js', 'tests/bronze_host/appdir_observer/']
  },
  {
    id: 'domparser',
    name: 'DOMParser',
    category: 'XML / HTML Parser',
    pilot: false,
    gate: 'None',
    description: 'W3C DOMParser interface parsing text/html and application/xml into a DOM Document',
    quickjs: [
      { path: 'src/js/html_interfaces.cpp' },
      { path: 'src/js/html_interfaces.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_parser.cpp' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['handle (DOMParser)', 'string (source, mime)', 'returns Document handle'],
    tests: ['tests/dom/test_dom_parser.js', 'tests/bronze_host/appdir_parser/']
  },
  {
    id: 'abort',
    name: 'AbortController / AbortSignal',
    category: 'Async Cancellation',
    pilot: false,
    gate: 'None',
    description: 'W3C AbortController and AbortSignal cancellation tokens for async operations & fetch',
    quickjs: [
      { path: 'third_party/brokit/src/api/abort.cpp' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_abort.cpp' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['handle (AbortController, AbortSignal)', 'boolean (aborted)', 'callback (onabort / EventListener)', 'any (reason)'],
    tests: ['tests/brokit/test_abort.js', 'tests/bronze_host/appdir_abort/']
  },
  {
    id: 'intl',
    name: 'Intl (ECMA-402)',
    category: 'Internationalization',
    pilot: false,
    gate: 'None',
    description: 'ECMA-402 Intl polyfill: PluralRules, NumberFormat, DateTimeFormat, Collator, DisplayNames',
    quickjs: [
      { path: 'src/js/js/intl_polyfill.js' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/dom_globals.cpp', start: 995, end: 1092, note: 'Intl object builder' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['string', 'number', 'dict/options'],
    tests: ['tests/intl/test_intl.js']
  },
  {
    id: 'vendor_globals',
    name: 'Vendor Globals (CodeMirror, acorn, etc.)',
    category: 'Vendored Library Bridges',
    pilot: false,
    gate: 'None',
    description: 'AOT host global bindings for compiled editors/parsers: CodeMirror, acorn, tern, esprima, jsonlint, draco_encoder, signals',
    quickjs: [],
    bronze_host: [
      { path: 'src/bronze_host/host_vendor_globals.cpp' },
      { path: 'src/bronze_host/web_host.globals', start: 118, end: 124, note: 'Vendor globals manifest entries' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['object', 'function', 'string'],
    tests: ['tests/bronze_host/appdir_codecs/']
  },
  {
    id: 'brokit.core',
    name: 'brokit (System & Web APIs)',
    category: 'Node / Web Core Runtime',
    pilot: false,
    gate: 'None',
    description: 'brokit runtime: fs, path, os, child_process, crypto, fetch, storage, stream, console',
    quickjs: [
      { path: 'third_party/brokit/src/api/api.cpp' },
      { path: 'third_party/brokit/src/api/crypto.cpp' },
      { path: 'third_party/brokit/src/api/crypto_subtle.cpp' },
      { path: 'third_party/brokit/src/api/encoding.cpp' },
      { path: 'third_party/brokit/src/api/eventsource.cpp' },
      { path: 'third_party/brokit/src/api/fetch.cpp' },
      { path: 'third_party/brokit/src/api/fetch_classes.cpp' },
      { path: 'third_party/brokit/src/api/formdata.cpp' },
      { path: 'third_party/brokit/src/api/fs.cpp' },
      { path: 'third_party/brokit/src/api/fs_watch.cpp' },
      { path: 'third_party/brokit/src/api/indexeddb.cpp' },
      { path: 'third_party/brokit/src/api/indexeddb_js.cpp' },
      { path: 'third_party/brokit/src/api/message_channel.cpp' },
      { path: 'third_party/brokit/src/api/navigator.cpp' },
      { path: 'third_party/brokit/src/api/net.cpp' },
      { path: 'third_party/brokit/src/api/os.cpp' },
      { path: 'third_party/brokit/src/api/path.cpp' },
      { path: 'third_party/brokit/src/api/process.cpp' },
      { path: 'third_party/brokit/src/api/readable_stream.cpp' },
      { path: 'third_party/brokit/src/api/storage.cpp' },
      { path: 'third_party/brokit/src/api/structuredclone.cpp' },
      { path: 'third_party/brokit/src/api/timers.cpp' },
      { path: 'third_party/brokit/src/api/treewalker.cpp' },
      { path: 'third_party/brokit/src/api/url.cpp' },
      { path: 'third_party/brokit/src/api/util.cpp' },
      { path: 'third_party/brokit/src/api/websocket.cpp' },
      { path: 'third_party/brokit/src/api/writable_stream.cpp' },
      { path: 'src/js/storage_bindings.cpp' },
      { path: 'src/js/storage_bindings.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_fetch.cpp' },
      { path: 'src/bronze_host/host_xhr.cpp' },
      { path: 'src/bronze_host/dom_storage.cpp' },
      { path: 'src/bronze_host/host_timers.cpp' }
    ],
    stubs: [],
    docs: [{ path: 'docs/brokit-api.js' }],
    ts: [],
    headless: [],
    shapes: ['handle (Stream, Request, Response, Headers, Socket, Process)', 'typedarray (Buffer, Uint8Array)', 'dict/options', 'promise', 'callback', 'string', 'number'],
    tests: ['tests/brokit/test_child_process.js', 'tests/brokit/test_fetch.js', 'tests/bronze_host/appdir_fetch/']
  },
  {
    id: 'headless.injection',
    name: 'Headless Injection & Test Surface',
    category: 'Headless Test Framework',
    pilot: false,
    gate: 'None',
    description: 'Driver globals (screenshot, advanceTime, assert, simulated inputs, inspection, __host)',
    quickjs: [
      { path: 'src/js/headless_bindings.cpp' },
      { path: 'src/js/headless_bindings.h' }
    ],
    bronze_host: [],
    stubs: [],
    docs: [{ path: 'docs/headless.md' }, { path: 'docs/inspect.md' }],
    ts: [],
    headless: [
      { path: 'src/headless/main.cpp' },
      { path: 'src/engine/headless_driver.cpp' },
      { path: 'src/engine/headless_driver.h' }
    ],
    shapes: ['string', 'number', 'boolean', 'dict/options', 'callback/listener handle'],
    tests: ['tests/headless/test_app_paths.js', 'tests/scene/test_host_scene_context.js']
  },
  {
    id: 'dom.core',
    name: 'DOM Core (Element / Node / Document)',
    category: 'DOM Core Machinery (Out of Scope for M1-M6)',
    pilot: false,
    gate: 'None',
    description: 'Core DOM nodes, elements, layout binding, attributes, styles, selectors (deeply entangled with gumbo/htmlayout)',
    quickjs: [
      { path: 'src/js/dom_bindings.cpp' },
      { path: 'src/js/dom_bindings.h' },
      { path: 'src/js/dom_bindings_internal.h' },
      { path: 'src/js/element_bindings.cpp' },
      { path: 'src/js/node_bindings.cpp' },
      { path: 'src/js/document_bindings.cpp' },
      { path: 'src/js/range_bindings.cpp' },
      { path: 'src/js/selection_bindings.cpp' },
      { path: 'src/js/shadowroot_bindings.cpp' },
      { path: 'src/js/style_bindings.cpp' },
      { path: 'src/js/js/dom_polyfills.js' },
      { path: 'src/js/js/dataset_proxy.js' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_element.cpp' },
      { path: 'src/bronze_host/host_element_style.cpp' },
      { path: 'src/bronze_host/host_element_dataset.cpp' },
      { path: 'src/bronze_host/host_element_forms.cpp' },
      { path: 'src/bronze_host/host_node.cpp' }
    ],
    stubs: [],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['handle (Element, Node, Document, Range, Selection, CSSStyleDeclaration)', 'string', 'number', 'boolean', 'dict/options', 'callback'],
    tests: ['tests/dom/test_append_remove.js', 'tests/gc/test_node_wrapper_invalidation.js', 'tests/bronze_host/appdir_dom/']
  },
  {
    id: 'runtime.core',
    name: 'Runtime Core & Interp Bridge',
    category: 'Runtime Machinery (Out of Scope for M1-M6)',
    pilot: false,
    gate: 'None',
    description: 'QuickJS runtime lifecycle, bronze HostClass / HostProxy, interpreter bridge, GC contracts',
    quickjs: [
      { path: 'src/js/runtime.cpp' },
      { path: 'src/js/runtime.h' },
      { path: 'src/js/timers.cpp' },
      { path: 'src/js/timers.h' }
    ],
    bronze_host: [
      { path: 'src/bronze_host/host_class.cpp' },
      { path: 'src/bronze_host/host_proxy.cpp' },
      { path: 'src/bronze_host/host_interp.cpp' },
      { path: 'src/bronze_host/host_interp.h' },
      { path: 'src/bronze_host/host_internal.h' },
      { path: 'src/bronze_host/bronze_host.h' },
      { path: 'src/bronze_host/app_module.cpp' },
      { path: 'src/bronze_host/app_module.h' }
    ],
    stubs: [
      { path: 'src/js/feature_stub.h' }
    ],
    docs: [],
    ts: [],
    headless: [],
    shapes: ['Engine JSValue / bronze Value internal machinery'],
    tests: ['tests/gc/test_create_remove_cycle.js', 'tests/bronze_host/appdir_interp/']
  }
];
