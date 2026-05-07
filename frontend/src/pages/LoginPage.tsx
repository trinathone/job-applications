import { useState, useEffect, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { login, register } from "../api/auth";
import { useAuthStore } from "../store/authStore";

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uMouse;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float t = uTime * aSpeed + aOffset;
    vec3 pos = position;
    pos.x += sin(t * 0.7 + position.z) * 0.4;
    pos.y += cos(t * 0.5 + position.x) * 0.3;
    pos.z += sin(t * 0.3) * 0.2;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (380.0 / -mv.z) * (1.0 + uMouse * 0.4);
    vAlpha = 0.3 + 0.7 * abs(sin(t * 0.5 + aOffset));
    float h = mod(aOffset * 0.15 + uTime * 0.04, 1.0);
    vColor = vec3(0.3 + 0.2*sin(h*6.28), 0.5 + 0.1*sin(h*6.28+2.1), 1.0);
  }
`;

const FRAG = /* glsl */`
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.45, d);
    float glow = (1.0 - smoothstep(0.0, 0.5, d)) * 0.5;
    gl_FragColor = vec4(vColor * (core + glow), (core + glow * 0.4) * vAlpha);
  }
`;

const GRID_VERT = /* glsl */`void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const GRID_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 g = fract(uv * 26.0);
    float line = step(0.965, g.x) + step(0.965, g.y);
    float dist = length(uv - uMouse);
    float wave = sin(dist * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    float glow = (1.0 - smoothstep(0.0, 0.55, dist)) * 0.18 * wave;
    vec3 base = vec3(0.04, 0.05, 0.12);
    vec3 lc   = vec3(0.08, 0.12, 0.35) + vec3(0.25, 0.35, 1.0) * glow;
    gl_FragColor = vec4(mix(base, lc, line * (0.25 + glow)), 1.0);
  }
`;

type Mode = "login" | "register";

export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded,   setLoaded]   = useState(false);
  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x03040d);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    // Grid
    const gridGeo = new THREE.PlaneGeometry(30, 30);
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: GRID_VERT, fragmentShader: GRID_FRAG,
      uniforms: {
        uTime:  { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRes:   { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.position.z = -4;
    scene.add(gridMesh);

    // Particles
    const COUNT = window.innerWidth < 768 ? 1000 : 2400;
    const pos = new Float32Array(COUNT * 3);
    const sz  = new Float32Array(COUNT);
    const sp  = new Float32Array(COUNT);
    const of  = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i*3]   = (Math.random()-0.5)*16;
      pos[i*3+1] = (Math.random()-0.5)*10;
      pos[i*3+2] = (Math.random()-0.5)*6;
      sz[i] = Math.random()*2.2+0.4;
      sp[i] = Math.random()*0.35+0.08;
      of[i] = Math.random()*Math.PI*2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    geo.setAttribute("aSize",    new THREE.BufferAttribute(sz,1));
    geo.setAttribute("aSpeed",   new THREE.BufferAttribute(sp,1));
    geo.setAttribute("aOffset",  new THREE.BufferAttribute(of,1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uTime:{value:0}, uMouse:{value:0} },
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(geo, mat));

    // Mouse
    const mouse = { x:0.5, y:0.5, sx:0.5, sy:0.5 };
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX/window.innerWidth; mouse.y = 1-e.clientY/window.innerHeight; };
    window.addEventListener("mousemove", onMove);
    const onResize = () => {
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      gridMat.uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf: number;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      mouse.sx += (mouse.x - mouse.sx)*0.04;
      mouse.sy += (mouse.y - mouse.sy)*0.04;
      mat.uniforms.uTime.value  = t;
      mat.uniforms.uMouse.value = (mouse.sx-0.5)*2;
      gridMat.uniforms.uTime.value = t;
      gridMat.uniforms.uMouse.value.set(mouse.sx, mouse.sy);
      camera.position.x = (mouse.sx-0.5)*0.5;
      camera.position.y = (mouse.sy-0.5)*0.35;
      camera.lookAt(0,0,0);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose(); geo.dispose(); mat.dispose(); gridMat.dispose(); gridGeo.dispose();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = mode === "login"
        ? await login(email, password)
        : await register(email, password, name||undefined);
      setAuth(r.access_token, { id:r.user_id, email:r.email, display_name:r.display_name });
      navigate("/dashboard", { replace:true });
    } catch(err: unknown) {
      setError((err as {response?:{data?:{detail?:string}}})?.response?.data?.detail ?? "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{background:"#03040d"}}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:"radial-gradient(ellipse 75% 75% at 50% 50%, transparent 25%, #03040d 100%)"
      }}/>

      {/* Top progress bar */}
      <div className={`absolute top-0 left-0 h-[2px] transition-all duration-1000 ${loaded?"w-full opacity-0":"w-2/5 opacity-100"}`}
        style={{background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#06b6d4)"}}/>

      <div className={`relative z-10 min-h-screen flex flex-col items-center justify-center px-4
        transition-all duration-1000 ease-out ${loaded?"opacity-100 translate-y-0":"opacity-0 translate-y-8"}`}>

        {/* Brand mark */}
        <div className="mb-10 text-center select-none">
          <h1 className="text-7xl font-black tracking-tighter leading-none"
            style={{
              background:"linear-gradient(135deg,#60a5fa 0%,#a78bfa 50%,#67e8f9 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              filter:"drop-shadow(0 0 30px rgba(99,102,241,0.5))",
            }}>JA</h1>
          <p className="mt-2 text-[10px] tracking-[0.5em] uppercase font-medium"
            style={{color:"rgba(148,163,184,0.5)"}}>Job Applications</p>
        </div>

        {/* Glass panel */}
        <div className="w-full max-w-[360px]" style={{filter:"drop-shadow(0 25px 60px rgba(99,102,241,0.12))"}}>
          <div className="rounded-2xl px-8 py-8" style={{
            background:"linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
            backdropFilter:"blur(32px)",
            border:"1px solid rgba(255,255,255,0.07)",
          }}>
            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-xl mb-7" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
              {(["login","register"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>{setMode(m);setError(null);}}
                  className="flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-lg transition-all duration-300"
                  style={mode===m?{
                    background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                    color:"white",
                    boxShadow:"0 4px 20px rgba(99,102,241,0.3)"
                  }:{color:"rgba(148,163,184,0.5)"}}>
                  {m==="login"?"Sign in":"Register"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode==="register"&&(
                <Field label="Name" type="text" value={name} set={setName} placeholder="Your name" ac="name"/>
              )}
              <Field label="Email" type="email" value={email} set={setEmail} placeholder="you@example.com" ac="email" req/>
              <Field label="Password" type="password" value={password} set={setPassword} placeholder="••••••••"
                ac={mode==="login"?"current-password":"new-password"} req min={mode==="register"?8:1}/>

              {error&&(
                <div className="rounded-xl px-4 py-3 text-xs" style={{
                  background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#fca5a5"
                }}>{error}</div>
              )}

              <button type="submit" disabled={busy}
                className="w-full py-3 mt-1 rounded-xl text-sm font-semibold text-white tracking-wide
                  transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                  boxShadow:"0 4px 24px rgba(99,102,241,0.3)",
                }}
                onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 6px 32px rgba(99,102,241,0.5)")}
                onMouseLeave={e=>(e.currentTarget.style.boxShadow="0 4px 24px rgba(99,102,241,0.3)")}>
                {busy
                  ?<span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    Please wait…
                  </span>
                  :mode==="login"?"Sign in →":"Create account →"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-8 text-[10px] tracking-[0.3em] uppercase select-none" style={{color:"rgba(100,116,139,0.4)"}}>
          Powered by JA
        </p>
      </div>
    </div>
  );
}

function Field({label,type,value,set,placeholder,ac,req,min}:{
  label:string;type:string;value:string;set:(v:string)=>void;
  placeholder?:string;ac?:string;req?:boolean;min?:number;
}) {
  return (
    <div>
      <label className="block mb-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase"
        style={{color:"rgba(148,163,184,0.6)"}}>{label}</label>
      <input type={type} value={value} onChange={e=>set(e.target.value)}
        placeholder={placeholder} autoComplete={ac} required={req} minLength={min}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
        style={{
          background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.07)",
          color:"#f1f5f9",
        }}
        onFocus={e=>{e.currentTarget.style.border="1px solid rgba(99,102,241,0.5)";e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
        onBlur={e=>{e.currentTarget.style.border="1px solid rgba(255,255,255,0.07)";e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
      />
    </div>
  );
}
