import fs from 'fs';

function inspectGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  // Header: magic (4), version (4), length (4)
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const totalLength = buffer.readUInt32LE(8);
  
  console.log(`GLB Magic: 0x${magic.toString(16)} ("gltf" is 0x46546c67)`);
  console.log(`GLB Version: ${version}`);
  console.log(`GLB Length: ${totalLength} bytes`);
  
  if (magic !== 0x46546c67) {
    console.error('Not a valid GLB file');
    return;
  }
  
  // First Chunk: chunkLength (4), chunkType (4)
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  
  console.log(`Chunk 0 Length: ${chunkLength}`);
  console.log(`Chunk 0 Type: 0x${chunkType.toString(16)} (JSON is 0x4e4f534a)`);
  
  if (chunkType !== 0x4e4f534a) {
    console.error('First chunk is not JSON');
    return;
  }
  
  const jsonBuffer = buffer.subarray(20, 20 + chunkLength);
  const jsonStr = jsonBuffer.toString('utf8');
  const gltf = JSON.parse(jsonStr);
  
  console.log('\n--- MATERIALS ---');
  if (gltf.materials) {
    gltf.materials.forEach((mat, index) => {
      console.log(`Material ${index}:`, JSON.stringify(mat, null, 2));
    });
  } else {
    console.log('No materials found in glTF structure.');
  }

  console.log('\n--- EXTENSIONS USED ---');
  console.log(gltf.extensionsUsed || 'None');
  
  console.log('\n--- MESHES ---');
  if (gltf.meshes) {
    gltf.meshes.forEach((mesh, index) => {
      console.log(`Mesh ${index} "${mesh.name || ''}":`, mesh.primitives.map(p => ({
        mode: p.mode,
        material: p.material,
        attributes: Object.keys(p.attributes)
      })));
    });
  }
}

inspectGlb('public/backup1.glb');
