import React, {useMemo} from "react";
import {ThreeCanvas} from "@remotion/three";
import {staticFile, useCurrentFrame} from "remotion";
import {Text, useTexture} from "@react-three/drei";
import * as THREE from "three";
import {RankingItem, TimelineSegment} from "./data";
import {Camera} from "./components/Camera";
import {Column} from "./components/Column";
import {sceneConfig} from "./config/sceneConfig";
import {numericValue} from "./value";
import {BRAND_INTRO_FRAMES, BRAND_OUTRO_FRAMES} from "./timing";

const CheckerFloor: React.FC = () => {
  const texture = useMemo(() => {
    const light = new THREE.Color(sceneConfig.floorLightColor);
    const dark = new THREE.Color(sceneConfig.floorDarkColor);
    const groutWidth = sceneConfig.floorGroutWidth;
    
    // Higher texture resolution keeps the one-pixel grout line visually thin.
    // High resolution lets the grout be thinner than a visible percentage of each tile.
    const size = 1024;
    const tile = size / 2;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tileX = x % tile;
        const tileY = y % tile;
        const seam = tileX < groutWidth || tileX >= tile - groutWidth ||
  tileY < groutWidth || tileY >= tile - groutWidth;
        const color = seam ? dark : light;
        const i = (y * size + x) * 4;
        pixels[i] = Math.round(color.r * 255);
        pixels[i + 1] = Math.round(color.g * 255);
        pixels[i + 2] = Math.round(color.b * 255);
        pixels[i + 3] = 255;
      }
    }
    const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    const repeat = sceneConfig.floorSize / (sceneConfig.floorTileSize * 2);
    map.repeat.set(repeat, repeat);
    // Smooth minification and mipmaps keep the thin grout lines from being
    // skipped by texture sampling when they recede into the distance.
    map.generateMipmaps = true;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.anisotropy = 16;
    map.needsUpdate = true;
    return map;
  }, []);

  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, sceneConfig.floorY, 0]} receiveShadow>
    <planeGeometry args={[sceneConfig.floorSize, sceneConfig.floorSize]} />
    <meshStandardMaterial map={texture} roughness={0.72} metalness={0.12} />
  </mesh>;
};

const BackgroundWall: React.FC = () => {
  const texture = useTexture(staticFile("assets/bg/BangkokBg.svg"));
  const wallAspect = 42 / 28;
  const image = texture.image as {width?: number; height?: number} | undefined;
  const imageAspect = image?.width && image?.height ? image.width / image.height : wallAspect;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (imageAspect > wallAspect) {
    texture.repeat.set(wallAspect / imageAspect, 1);
    texture.offset.set((1 - texture.repeat.x) / 2, 0);
  } else {
    texture.repeat.set(1, imageAspect / wallAspect);
    texture.offset.set(0, (1 - texture.repeat.y) / 2);
  }
  texture.needsUpdate = true;
  return <mesh position={[0, 10, -9]} rotation={[0, 0, 0]}>
    <planeGeometry args={[42, 28]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
};

const shapeRoadText = (mesh: THREE.Mesh) => {
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position || mesh.userData.roadShapeApplied) return;
  mesh.userData.roadShapeApplied = true;

  const box = new THREE.Box3().setFromBufferAttribute(position);
  const height = Math.max(0.001, box.max.y - box.min.y);
  for (let index = 0; index < position.count; index++) {
    const y = position.getY(index);
    const depthProgress = (y - box.min.y) / height;
    // Near/front edge is narrower; far/back edge opens outward like a road.
    const widthFactor = THREE.MathUtils.lerp(0.76, 1.24, depthProgress);
    position.setXYZ(index, position.getX(index) * widthFactor, y * 1.28, position.getZ(index));
  }
  position.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
};

const ChromeBrand: React.FC<{position: [number, number, number]; scale: number; rotation?: [number, number, number]; color?: string}> = ({position, scale, rotation = [0, 0, 0], color = "#08a6cc"}) => {
  return <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
    <Text
      position={[0, 4, 0]}
      fontSize={3.35}
      fontWeight={700}
      letterSpacing={0}
      color={color}
      anchorX="center"
      anchorY="middle"
      scale={[1.6, 0.72, 1]}
    >
      {"Data Vision"}
    </Text>
  </group>;
};

const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= BRAND_INTRO_FRAMES) return null;
  return null;
};

const BrandOutro: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame() - startFrame;
  if (frame < 0 || frame >= BRAND_OUTRO_FRAMES) return null;
  return <ChromeBrand position={[0, 15.2, -8.5]} scale={0.82} rotation={[0, 0, 0]} color="#123B66" />;
};

export const Scene: React.FC<{items: RankingItem[]; timeline?: TimelineSegment[]; startOffsetFrames?: number; contentDurationFrames: number}> = ({items, timeline, startOffsetFrames = 0, contentDurationFrames}) => {
  const ordered = [...items].sort((a, b) => b.rank - a.rank);
  const maxValue = Math.max(...ordered.map((item) => numericValue(item.value)));
  return <ThreeCanvas width={1080} height={1920} gl={{alpha: true}} camera={{position: [-15, 6.5, 20], fov: 42, near: 0.1, far: 100}} shadows>
    <ambientLight intensity={1.1} />
    <directionalLight
      position={[10, 16, 12]}
      intensity={3.5}
      castShadow
      shadow-mapSize-width={sceneConfig.shadowMapSize}
      shadow-mapSize-height={sceneConfig.shadowMapSize}
      shadow-camera-left={sceneConfig.shadowCameraLeft}
      shadow-camera-right={sceneConfig.shadowCameraRight}
      shadow-camera-top={sceneConfig.shadowCameraTop}
      shadow-camera-bottom={sceneConfig.shadowCameraBottom}
      shadow-camera-near={sceneConfig.shadowCameraNear}
      shadow-camera-far={sceneConfig.shadowCameraFar}
      shadow-bias={sceneConfig.shadowBias}
      shadow-normalBias={sceneConfig.shadowNormalBias}
    />
    <pointLight position={[-8, 6, 6]} intensity={18} distance={40} />
    <pointLight position={[0, 10, 55]} intensity={75} distance={90} color="#fff3cf" />
    <Camera items={items} timeline={timeline} startOffsetFrames={startOffsetFrames} contentDurationFrames={contentDurationFrames} />
    <CheckerFloor />
    <BackgroundWall />
    <BrandOutro startFrame={startOffsetFrames + contentDurationFrames} />
    {ordered.map((item, index) => <Column key={`${item.rank}-${item.name}`} item={item} index={index} total={ordered.length} maxValue={maxValue} />)}
  </ThreeCanvas>;
};
