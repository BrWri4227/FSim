import * as THREE from "three";

export type Section = { z: number; width: number; height: number; y?: number };
export type PointXZ = readonly [number, number];

export const Materials = {
  body: new THREE.MeshStandardMaterial({ color: 0x7f878c, roughness: 0.72, metalness: 0.18 }),
  bodyLight: new THREE.MeshStandardMaterial({ color: 0x9aa1a5, roughness: 0.72, metalness: 0.14 }),
  bodyDark: new THREE.MeshStandardMaterial({ color: 0x4d5458, roughness: 0.78, metalness: 0.18 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.9 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x06130d, emissive: 0x37ff91, emissiveIntensity: 0.25 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x6f98a2, transparent: true, opacity: 0.45, transmission: 0.3, roughness: 0.08, depthWrite: false, side: THREE.DoubleSide }),
  glassGold: new THREE.MeshPhysicalMaterial({ color: 0xb89558, transparent: true, opacity: 0.48, transmission: 0.24, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ color: 0x72797d, roughness: 0.42, metalness: 0.75 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.96 }),
  intake: new THREE.MeshStandardMaterial({ color: 0x090b0c, roughness: 0.9, side: THREE.DoubleSide }),
  exhaust: new THREE.MeshStandardMaterial({ color: 0x2b2b2a, roughness: 0.58, metalness: 0.78 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0x485044, roughness: 1 }),
  warning: new THREE.MeshStandardMaterial({ color: 0xffb400, emissive: 0xff7700, emissiveIntensity: 0.4 }),
};

export function addMesh(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position = new THREE.Vector3(), rotation = new THREE.Euler()): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.position.copy(position); mesh.rotation.copy(rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function box(parent: THREE.Group, name: string, size: [number,number,number], pos: [number,number,number], mat: THREE.Material = Materials.body, rot: [number,number,number]=[0,0,0]): THREE.Mesh {
  return addMesh(parent,name,new THREE.BoxGeometry(...size),mat,new THREE.Vector3(...pos),new THREE.Euler(...rot));
}

export function cylinder(parent: THREE.Group, name: string, rt: number, rb: number, h: number, pos: [number,number,number], mat: THREE.Material = Materials.body, rot: [number,number,number]=[Math.PI/2,0,0], seg=24): THREE.Mesh {
  return addMesh(parent,name,new THREE.CylinderGeometry(rt,rb,h,seg),mat,new THREE.Vector3(...pos),new THREE.Euler(...rot));
}

export function capsule(parent: THREE.Group, name: string, radius: number, length: number, pos: [number,number,number], mat: THREE.Material = Materials.body, scale: [number,number,number]=[1,1,1]): THREE.Mesh {
  const m=addMesh(parent,name,new THREE.CapsuleGeometry(radius,length,8,20),mat,new THREE.Vector3(...pos),new THREE.Euler(Math.PI/2,0,0));
  m.scale.set(...scale); return m;
}

export function prismXZ(parent: THREE.Group, name: string, points: PointXZ[], thickness: number, y: number, mat: THREE.Material = Materials.body): THREE.Mesh {
  const first = points[0]!
  const shape=new THREE.Shape(); shape.moveTo(first[0],first[1]);
  for(let i=1;i<points.length;i++) { const p = points[i]!; shape.lineTo(p[0],p[1]); } shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});
  g.rotateX(Math.PI/2); g.translate(0,-thickness/2,0); g.computeVertexNormals();
  return addMesh(parent,name,g,mat,new THREE.Vector3(0,y,0));
}

export function loft(parent: THREE.Group, name: string, sections: Section[], mat: THREE.Material = Materials.body, radial=16): THREE.Mesh {
  const vertices:number[]=[]; const indices:number[]=[];
  for(const s of sections){
    for(let i=0;i<radial;i++){
      const a=i/radial*Math.PI*2;
      vertices.push(Math.cos(a)*s.width,(s.y??0)+Math.sin(a)*s.height,s.z);
    }
  }
  for(let j=0;j<sections.length-1;j++) for(let i=0;i<radial;i++){
    const n=(i+1)%radial,a=j*radial+i,b=j*radial+n,c=(j+1)*radial+n,d=(j+1)*radial+i;
    indices.push(a,b,d,b,c,d);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); g.setIndex(indices); g.computeVertexNormals();
  return addMesh(parent,name,g,mat);
}

export function verticalFin(parent:THREE.Group,name:string, points:readonly [number,number][], x:number, z:number, thickness:number, cant:number, mat:THREE.Material=Materials.body):THREE.Mesh{
  const first = points[0]!
  const shape=new THREE.Shape(); shape.moveTo(first[0],first[1]); for(let i=1;i<points.length;i++) { const p = points[i]!; shape.lineTo(p[0],p[1]); } shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}); g.center();
  return addMesh(parent,name,g,mat,new THREE.Vector3(x,0,z),new THREE.Euler(0,0,cant));
}

export function wheel(parent:THREE.Group,name:string,pos:[number,number,number],r:number,w:number):void{
  cylinder(parent,name,r,r,w,pos,Materials.rubber,[0,0,Math.PI/2],24);
  cylinder(parent,name+'Hub',r*.48,r*.48,w+.02,pos,Materials.metal,[0,0,Math.PI/2],20);
}

export function canopyWedge(parent:THREE.Group,name:string,length:number,width:number,height:number,pos:[number,number,number],gold=false):THREE.Mesh{
  const p=[[-width/2,0,-length/2],[width/2,0,-length/2],[-width*.4,height,0],[width*.4,height,0],[-width/2,0,length/2],[width/2,0,length/2]];
  const f=[0,1,2,1,3,2,2,3,4,3,5,4,0,2,4,1,5,3];
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3)); g.setIndex(f); g.computeVertexNormals();
  return addMesh(parent,name,g,gold?Materials.glassGold:Materials.glass,new THREE.Vector3(...pos));
}

export function mfd(parent:THREE.Group,name:string,pos:[number,number,number],size:[number,number],rotX=-0.1):THREE.Group{
  const g=new THREE.Group();g.name=name;g.position.set(...pos);g.rotation.x=rotX;parent.add(g);
  box(g,name+'Frame',[size[0]+.08,size[1]+.08,.05],[0,0,0],Materials.panel);
  box(g,name+'Screen',[size[0],size[1],.012],[0,0,-.032],Materials.screen);
  return g;
}

export function simpleSeat(parent:THREE.Group,pos:[number,number,number],scale=1):void{
  box(parent,'SeatBase',[.58*scale,.16*scale,.66*scale],[pos[0],pos[1],pos[2]],Materials.panel,[.08,0,0]);
  box(parent,'SeatBack',[.58*scale,.95*scale,.16*scale],[pos[0],pos[1]+.56*scale,pos[2]+.38*scale],Materials.panel,[-.16,0,0]);
  box(parent,'SeatCushion',[.47*scale,.09*scale,.52*scale],[pos[0],pos[1]+.12*scale,pos[2]-.03*scale],Materials.cushion);
  box(parent,'Headrest',[.38*scale,.25*scale,.22*scale],[pos[0],pos[1]+1.08*scale,pos[2]+.5*scale],Materials.panel);
}

export function stick(parent:THREE.Group,pos:[number,number,number],sideStick=false):void{
  cylinder(parent,'StickShaft',.025,.04,.38,pos,Materials.metal,[0,0,sideStick?-.18:0],12);
  capsule(parent,'StickGrip',.055,.12,[pos[0],pos[1]+.22,pos[2]],Materials.panel,[1,1,1]);
}

export function throttle(parent:THREE.Group,pos:[number,number,number],dual=false):void{
  for(const dx of dual?[-.035,.035]:[0]){box(parent,'ThrottleLever',[.035,.26,.035],[pos[0]+dx,pos[1],pos[2]],Materials.metal,[-.18,0,0]);capsule(parent,'ThrottleGrip',.045,.1,[pos[0]+dx,pos[1]+.14,pos[2]-.02],Materials.panel);}
}
