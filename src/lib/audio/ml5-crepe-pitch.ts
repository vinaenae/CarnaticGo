/**
 * ml5.js CREPE pitch detection in the browser (TensorFlow.js).
 * Ported from ml5 PitchDetection — same model URL as Coding Train #151.
 *
 * @see https://github.com/ml5js/ml5-library/blob/main/src/PitchDetection/index.js
 * @see https://thecodingtrain.com/CodingChallenges/151-ukulele-tuner.html
 * @see https://youtu.be/F1OkDTUkKFo
 */

/** Shiffman / ml5 CREPE weights (jsDelivr mirror). */
export const ML5_CREPE_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/";

export type Ml5CrepePitchDetector = {
  getPitch: () => Promise<number | null>;
  dispose: () => void;
};

type CrepeModelBundle = {
  model: import("@tensorflow/tfjs").LayersModel;
  centMapping: import("@tensorflow/tfjs").Tensor;
};

let tfModule: typeof import("@tensorflow/tfjs") | null = null;
let crepeBundlePromise: Promise<CrepeModelBundle> | null = null;

async function loadTf() {
  if (!tfModule) {
    tfModule = await import("@tensorflow/tfjs");
    await import("@tensorflow/tfjs-backend-webgl");
    await tfModule.setBackend("webgl");
    await tfModule.ready();
  }
  return tfModule;
}

/** One shared CREPE graph — avoids dispose races when React remounts the mic hook. */
async function loadCrepeBundle(
  modelBaseUrl: string = ML5_CREPE_MODEL_URL,
): Promise<CrepeModelBundle> {
  if (!crepeBundlePromise) {
    crepeBundlePromise = (async () => {
      const tf = await loadTf();
      const base = modelBaseUrl.endsWith("/") ? modelBaseUrl : `${modelBaseUrl}/`;
      const model = await tf.loadLayersModel(`${base}model.json`);
      const centMapping = tf.add(
        tf.linspace(0, 7180, 360),
        tf.tensor(1997.3794084376191),
      );
      return { model, centMapping };
    })().catch((err) => {
      crepeBundlePromise = null;
      throw err;
    });
  }
  return crepeBundlePromise;
}

function resampleTo1024(audioBuffer: AudioBuffer): Float32Array {
  const interpolate = audioBuffer.sampleRate % 16000 !== 0;
  const multiplier = audioBuffer.sampleRate / 16000;
  const original = audioBuffer.getChannelData(0);
  const subsamples = new Float32Array(1024);
  for (let i = 0; i < 1024; i += 1) {
    if (!interpolate) {
      subsamples[i] = original[i * multiplier] ?? 0;
    } else {
      const left = Math.floor(i * multiplier);
      const right = left + 1;
      const p = i * multiplier - left;
      const a = original[left] ?? 0;
      const b = original[right] ?? 0;
      subsamples[i] = (1 - p) * a + p * b;
    }
  }
  return subsamples;
}

/**
 * `ml5.pitchDetection(model_url, audioContext, stream)` — loads CREPE and wires the mic.
 */
export async function createMl5CrepePitchDetection(
  audioContext: AudioContext,
  stream: MediaStream,
  modelBaseUrl: string = ML5_CREPE_MODEL_URL,
): Promise<Ml5CrepePitchDetector> {
  const tf = await loadTf();
  const { model, centMapping } = await loadCrepeBundle(modelBaseUrl);

  let frequency: number | null = null;
  let disposed = false;
  let scriptNode: ScriptProcessorNode | null = null;
  let gain: GainNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let lastInferMs = 0;
  const inferIntervalMs = 66;

  const processMicrophoneBuffer = (event: AudioProcessingEvent) => {
    if (disposed) return;

    const now = performance.now();
    if (now - lastInferMs < inferIntervalMs) return;
    lastInferMs = now;

    const resampled = resampleTo1024(event.inputBuffer);
    tf.tidy(() => {
      if (disposed) return;

      const frame = tf.tensor(resampled.slice(0, 1024));
      const zeromean = tf.sub(frame, tf.mean(frame));
      const normVal = tf.norm(zeromean).dataSync()[0] / Math.sqrt(1024);
      const framestd = tf.tensor(normVal);
      const normalized = tf.div(zeromean, framestd);
      const input = normalized.reshape([1, 1024]);
      const activation = model.predict(input) as import("@tensorflow/tfjs").Tensor;
      const act2d = activation.reshape([360]);
      const confidence = act2d.max().dataSync()[0];
      const center = act2d.argMax().dataSync()[0];

      const start = Math.max(0, center - 4);
      const end = Math.min(360, center + 5);
      const weights = act2d.slice([start], [end - start]);
      const cents = centMapping.slice([start], [end - start]);

      const products = tf.mul(weights, cents);
      const productData = products.dataSync();
      const weightData = weights.dataSync();
      let productSum = 0;
      let weightSum = 0;
      for (let i = 0; i < productData.length; i += 1) {
        productSum += productData[i] ?? 0;
        weightSum += weightData[i] ?? 0;
      }
      const predictedCent = productSum / weightSum;
      const predictedHz = 10 * 2 ** (predictedCent / 1200);

      frequency = confidence > 0.5 ? predictedHz : null;
      activation.dispose();
    });
  };

  source = audioContext.createMediaStreamSource(stream);
  const minBufferSize = (audioContext.sampleRate / 16000) * 1024;
  let bufferSize = 4;
  while (bufferSize < minBufferSize) bufferSize *= 2;

  scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  scriptNode.onaudioprocess = processMicrophoneBuffer;
  gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, audioContext.currentTime);

  source.connect(scriptNode);
  scriptNode.connect(gain);
  gain.connect(audioContext.destination);

  if (audioContext.state !== "running") {
    await audioContext.resume();
  }

  return {
    getPitch: async () => frequency,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      scriptNode?.disconnect();
      source?.disconnect();
      gain?.disconnect();
      scriptNode = null;
      source = null;
      gain = null;
      frequency = null;
    },
  };
}
