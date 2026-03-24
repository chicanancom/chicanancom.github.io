import * as THREE from 'three';
import './style.css';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
document.getElementById('app')?.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);

const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1) },
    iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
};

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const fragmentShader = `
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;

mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
const mat3 m3 = mat3(0.33338, 0.56034, -0.71817, -0.87887, 0.32651, -0.15323, 0.15162, 0.69596, 0.61339)*1.93;
float mag2(vec2 p){return dot(p,p);}
float linstep(in float mn, in float mx, in float x){ return clamp((x - mn)/(mx - mn), 0., 1.); }
float prm1 = 0.;
vec2 bsMo = vec2(0);

vec2 disp(float t){ return vec2(sin(t*0.22)*1.2, cos(t*0.175)*1.2)*2.0; }

// RAINBOW HELPER
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}

vec2 map(vec3 p)
{
    vec3 p2 = p;
    p2.xy -= disp(p.z).xy;
    p.xy *= rot(sin(p.z+iTime)*(0.1 + prm1*0.05) + iTime*0.09);
    float cl = mag2(p2.xy);
    float d = 0.;
    p *= .61;
    float z = 1.;
    float trk = 1.;
    float dspAmp = 0.1 + prm1*0.2;
    for(int i = 0; i < 5; i++)
    {
		p += sin(p.zxy*0.75*trk + iTime*trk*.8)*dspAmp;
        d -= abs(dot(cos(p), sin(p.yzx))*z);
        z *= 0.57;
        trk *= 1.4;
        p = p*m3;
    }
    d = abs(d + prm1*3.)+ prm1*.3 - 2.5 + bsMo.y;
    return vec2(d + cl*.2 + 0.25, cl);
}

vec4 render( in vec3 ro, in vec3 rd, float time )
{
	vec4 rez = vec4(0);
	float t = 1.5;
	float fogT = 0.;
	for(int i=0; i<130; i++)
	{
		if(rez.a > 0.99)break;

		vec3 pos = ro + t*rd;
        vec2 mpv = map(pos);
		float den = clamp(mpv.x-0.3,0.,1.)*1.12;
		float dn = clamp((mpv.x + 2.),0.,3.);
        
		vec4 col = vec4(0);
        if (mpv.x > 0.6)
        {
            // NEW: DYNAMIC RAINBOW COLORS
            float colorPhase = pos.z * 0.1 + iTime * 0.2;
            vec3 cloudCol = palette(colorPhase);
            
            col = vec4(cloudCol * (sin(vec3(5.0, 0.4, 0.2) + mpv.y * 0.1 + sin(pos.z * 0.4) * 0.5 + 1.8) * 0.5 + 0.5), 0.08);
            col *= den*den*den;
			col.rgb *= linstep(4.,-2.5, mpv.x)*2.3;
            float dif =  clamp((den - map(pos+0.8).x)/9.0, 0.001, 1.0 );
            dif += clamp((den - map(pos+0.35).x)/2.5, 0.001, 1.0 );
            col.xyz *= den*(vec3(0.005, 0.045, 0.075) + 1.5 * vec3(0.033, 0.07, 0.03) * dif);
        }
		
		float fogC = exp(t*0.22 - 2.5);
		col.rgba += vec4(palette(iTime * 0.05) * 0.05, 0.1) * clamp(fogC - fogT, 0.0, 1.0);
		fogT = fogC;
		rez = rez + col*(1. - rez.a);
		t += clamp(0.5 - dn*dn*.05, 0.09, 0.3);
	}
	return clamp(rez, 0.0, 1.0);
}

float getsat(vec3 c)
{
    float mi = min(min(c.x, c.y), c.z);
    float ma = max(max(c.x, c.y), c.z);
    return (ma - mi)/(ma+ 1e-7);
}

vec3 iLerp(in vec3 a, in vec3 b, in float x)
{
    vec3 ic = mix(a, b, x) + vec3(1e-6,0.,0.);
    float sd = abs(getsat(ic) - mix(getsat(a), getsat(b), x));
    vec3 dir = normalize(vec3(2.*ic.x - ic.y - ic.z, 2.*ic.y - ic.x - ic.z, 2.*ic.z - ic.y - ic.x));
    float lgt = dot(vec3(1.0), ic);
    float ff = dot(dir, normalize(ic));
    ic += 1.5*dir*sd*ff*lgt;
    return clamp(ic,0.,1.);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main()
{	
	vec2 q = gl_FragCoord.xy/iResolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5*iResolution.xy)/iResolution.y;
    bsMo = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
    
    float time = iTime * 0.12;
    vec3 ro = vec3(0,0,time * 3.0);
    ro += vec3(sin(iTime*0.4)*0.6, sin(iTime*0.25)*0.3, 0);
        
    float dspAmp = .85;
    ro.xy += disp(ro.z)*dspAmp;
    float tgtDst = 3.5;
    
    vec3 target = normalize(ro - vec3(disp(ro.z + tgtDst)*dspAmp, ro.z + tgtDst));
    ro.x -= bsMo.x * 2.5;
    ro.y -= bsMo.y * 1.5;

    vec3 rightdir = normalize(cross(target, vec3(0,1,0)));
    vec3 updir = normalize(cross(rightdir, target));
	vec3 rd = normalize((p.x*rightdir + p.y*updir)*1.3 - target);
    rd.xy *= rot(-disp(ro.z + 3.5).x*0.12 + bsMo.x * 0.6);
    
    prm1 = smoothstep(-0.4, 0.4, sin(iTime*0.15));
	vec4 scn = render(ro, rd, time * 3.0);
		
    vec3 col = scn.rgb;
    // Dynamic Blend
    col = iLerp(col.bgr, col.rgb, clamp(1.0 - prm1, 0.05, 1.0));
    
    col = pow(col, vec3(0.55, 0.65, 0.6)) * 1.1;

    // Vignette
    col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.12)*0.8+0.2;
    
    // Film Grain
    col += (hash(q + iTime) - 0.5) * 0.02;

	gl_FragColor = vec4( col, 1.0 );
}
`;

const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Post Processing Setup
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,  // Strength
    0.5,  // Radius
    0.85  // Threshold
);
composer.addPass(bloomPass);

// Smooth Interactivity
let curX = 0, curY = 0;
let tgtX = 0, tgtY = 0;

window.addEventListener('mousemove', (e) => {
    tgtX = e.clientX;
    tgtY = window.innerHeight - e.clientY;
});

function animate() {
    requestAnimationFrame(animate);
    
    curX += (tgtX - curX) * 0.06;
    curY += (tgtY - curY) * 0.06;
    
    uniforms.iMouse.value.x = curX;
    uniforms.iMouse.value.y = curY;
    uniforms.iTime.value = performance.now() / 1000;
    
    composer.render();
}

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    uniforms.iResolution.value.set(w, h, 1);
});

animate();
