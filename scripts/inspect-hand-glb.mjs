import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buf = readFileSync(join(root, "public/models/hand/rigged-hand.glb"));
const loader = new GLTFLoader();
loader.parse(buf.buffer, "", (gltf) => {
  gltf.scene.traverse((o) => {
    if (o.isSkinnedMesh) {
      console.log("SkinnedMesh:", o.name);
      o.skeleton.bones.forEach((b, i) => {
        console.log(i, b.name, "parent:", b.parent?.name ?? "null");
      });
    }
  });
});
