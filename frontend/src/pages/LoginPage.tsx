import { useState, useEffect, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { login, register, requestOtp, verifyOtp, googleAuth, inviteAuth } from "../api/auth";
import { useAuthStore } from "../store/authStore";

/* ── GLSL ─────────────────────────────────────────────────────────── */
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
    vAlpha = 0.15 + 0.5 * abs(sin(t * 0.5 + aOffset));
    vColor = vec3(0.5);
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
    float glow = (1.0 - smoothstep(0.0, 0.55, dist)) * 0.15 * wave;
    vec3 base = vec3(0.02);
    vec3 lc   = vec3(0.1) + vec3(0.7) * glow;
    gl_FragColor = vec4(mix(base, lc, line * (0.25 + glow)), 1.0);
  }
`;

/* ── Types ────────────────────────────────────────────────────────── */
type AuthFlow = "google_otp" | "password" | "invite";
type OtpStep  = "email" | "code";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, opts: object): void;
          prompt(): void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function isGmail(email: string) {
  return email.trim().toLowerCase().endsWith("@gmail.com");
}

/* ── Component ────────────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [loaded,  setLoaded]  = useState(false);
  const [flow,    setFlow]    = useState<AuthFlow>("google_otp");
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [name,    setName]    = useState("");
  const [pwMode,  setPwMode]  = useState<"login" | "register">("login");
  const [error,   setError]   = useState<string | null>(null);
  const [info,    setInfo]    = useState<string | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(t);
  }, []);

  /* ── THREE.js background ──────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

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

    const COUNT = window.innerWidth < 768 ? 800 : 2400;
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

  /* ── Google GSI ───────────────────────────────────────────────── */
  useEffect(() => {
    if (flow !== "google_otp" || !GOOGLE_CLIENT_ID) return;

    const initGsi = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setError(null); setBusy(true);
          try {
            const r = await googleAuth(response.credential);
            setAuth(r.access_token, { id: r.user_id, email: r.email, display_name: r.display_name, is_admin: false });
            navigate("/dashboard", { replace: true });
          } catch (err: unknown) {
            setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Google sign-in failed.");
          } finally { setBusy(false); }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        width: googleBtnRef.current.offsetWidth || 320,
        text: "continue_with",
        shape: "rectangular",
      });
    };

    if (window.google) {
      initGsi();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, [flow, navigate, setAuth]);

  /* ── Countdown timer ──────────────────────────────────────────── */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* ── OTP: send code ───────────────────────────────────────────── */
  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isGmail(email)) {
      setError("Only Gmail addresses (@gmail.com) are accepted.");
      return;
    }
    setBusy(true);
    try {
      await requestOtp(email.trim().toLowerCase());
      setOtpStep("code");
      setCountdown(60);
      setInfo(`Code sent to ${email.trim().toLowerCase()}`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to send code.");
    } finally { setBusy(false); }
  }

  /* ── OTP: verify code ─────────────────────────────────────────── */
  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await verifyOtp(email.trim().toLowerCase(), code.trim());
      setAuth(r.access_token, { id: r.user_id, email: r.email, display_name: r.display_name, is_admin: false });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Invalid code.");
    } finally { setBusy(false); }
  }

  /* ── Password: login/register ─────────────────────────────────── */
  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = pwMode === "login"
        ? await login(email, password)
        : await register(email, password, name || undefined);
      setAuth(r.access_token, { id: r.user_id, email: r.email, display_name: r.display_name, is_admin: false });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Something went wrong.");
    } finally { setBusy(false); }
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await inviteAuth(inviteCode.trim());
      setAuth(r.access_token, { id: r.user_id, email: r.email, display_name: r.display_name, is_admin: false });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Invalid invitation code.");
    } finally { setBusy(false); }
  }

  /* ── UI helpers ───────────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    fontSize: 14, outline: "none",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ffffff",
    boxSizing: "border-box",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%", padding: "13px 0", borderRadius: 10,
    fontSize: 14, fontWeight: 600, letterSpacing: "0.02em",
    background: "#ffffff", color: "#000000",
    border: "none", cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.5 : 1, transition: "opacity 0.15s",
  };

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div style={{ position: "relative", minHeight: "100svh", overflow: "hidden", background: "#000000" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Dark overlay — makes card legible regardless of background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "rgba(0,0,0,0.72)",
      }} />
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 0%, #000000 100%)",
      }} />

      {/* Top progress bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, height: 2,
        width: loaded ? "100%" : "40%",
        opacity: loaded ? 0 : 1,
        background: "rgba(255,255,255,0.6)",
        transition: "width 1s, opacity 1s",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        minHeight: "100svh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        opacity: loaded ? 1 : 0,
        transform: loaded ? "none" : "translateY(20px)",
        transition: "opacity 1s, transform 1s",
      }}>

        {/* Brand */}
        <div style={{ marginBottom: 36, textAlign: "center", userSelect: "none" }}>
          <h1 style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: "#ffffff", margin: 0 }}>
            JA
          </h1>
          <p style={{ marginTop: 8, fontSize: 10, letterSpacing: "0.5em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
            Job Applications
          </p>
        </div>

        {/* Card */}
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{
            borderRadius: 20, padding: "32px",
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
          }}>

            {/* ── Google + OTP flow ─────────────────────────────── */}
            {flow === "google_otp" && (
              <>
                {/* Google Sign-In button */}
                {GOOGLE_CLIENT_ID ? (
                  <div style={{ marginBottom: 20 }}>
                    <div ref={googleBtnRef} style={{ width: "100%", minHeight: 44 }} />
                  </div>
                ) : (
                  <div style={{
                    marginBottom: 20, padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center",
                  }}>
                    Google Sign-In not configured (set VITE_GOOGLE_CLIENT_ID)
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    or email code
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>

                {/* OTP: step 1 — email */}
                {otpStep === "email" && (
                  <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                      type="email" required
                      placeholder="you@gmail.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                      onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    />
                    {error && <ErrorBox>{error}</ErrorBox>}
                    <button type="submit" disabled={busy} style={primaryBtn}>
                      {busy ? "Sending…" : "Send code →"}
                    </button>
                  </form>
                )}

                {/* OTP: step 2 — code */}
                {otpStep === "code" && (
                  <form onSubmit={verifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {info && (
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", margin: 0 }}>
                        {info}
                      </p>
                    )}
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]{6}"
                      maxLength={6} required
                      placeholder="123456"
                      value={code}
                      onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                      style={{ ...inputStyle, textAlign: "center", fontSize: 22, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.3em" }}
                      onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                      onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                      autoFocus
                    />
                    {error && <ErrorBox>{error}</ErrorBox>}
                    <button type="submit" disabled={busy} style={primaryBtn}>
                      {busy ? "Verifying…" : "Verify code →"}
                    </button>
                    <button
                      type="button"
                      disabled={countdown > 0}
                      onClick={() => { setOtpStep("email"); setCode(""); setError(null); setInfo(null); }}
                      style={{
                        background: "none", border: "none", cursor: countdown > 0 ? "not-allowed" : "pointer",
                        fontSize: 11, color: countdown > 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)",
                        textAlign: "center",
                      }}
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : "← Back / resend"}
                    </button>
                  </form>
                )}

                {/* Switch to password */}
                <button
                  onClick={() => { setFlow("password"); setError(null); setInfo(null); }}
                  style={{
                    marginTop: 20, width: "100%", background: "none", border: "none",
                    fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  Sign in with password
                </button>
                <button
                  onClick={() => { setFlow("invite"); setError(null); setInfo(null); }}
                  style={{
                    marginTop: 10, width: "100%", background: "none", border: "none",
                    fontSize: 11, color: "rgba(255,255,255,0.32)", cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  Special invitation
                </button>
              </>
            )}

            {flow === "invite" && (
              <>
                <form onSubmit={submitInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="password"
                    required
                    placeholder="Invitation code"
                    value={inviteCode}
                    onChange={e => { setInviteCode(e.target.value); setError(null); }}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  />
                  {error && <ErrorBox>{error}</ErrorBox>}
                  <button type="submit" disabled={busy} style={primaryBtn}>
                    {busy ? "Checking…" : "Enter →"}
                  </button>
                </form>
                <button
                  onClick={() => { setFlow("google_otp"); setError(null); }}
                  style={{
                    marginTop: 16, width: "100%", background: "none", border: "none",
                    fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  ← Back to sign in
                </button>
              </>
            )}

            {/* ── Password flow ──────────────────────────────────── */}
            {flow === "password" && (
              <>
                {/* Mode tabs */}
                <div style={{
                  display: "flex", gap: 4, padding: 4, borderRadius: 10, marginBottom: 20,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {(["login", "register"] as const).map(m => (
                    <button key={m} onClick={() => { setPwMode(m); setError(null); }}
                      style={{
                        flex: 1, padding: "8px 0",
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                        borderRadius: 7, border: "none", cursor: "pointer", transition: "all 0.2s",
                        background: pwMode === m ? "#ffffff" : "transparent",
                        color: pwMode === m ? "#000000" : "rgba(255,255,255,0.3)",
                      }}>
                      {m === "login" ? "Sign in" : "Register"}
                    </button>
                  ))}
                </div>

                <form onSubmit={submitPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pwMode === "register" && (
                    <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                      onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    />
                  )}
                  <input type="email" required placeholder="you@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  />
                  <input type="password" required placeholder="Password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    minLength={pwMode === "register" ? 8 : 1}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  />
                  {error && <ErrorBox>{error}</ErrorBox>}
                  <button type="submit" disabled={busy} style={primaryBtn}>
                    {busy ? "Please wait…" : pwMode === "login" ? "Sign in →" : "Create account →"}
                  </button>
                </form>

                <button
                  onClick={() => { setFlow("google_otp"); setOtpStep("email"); setError(null); }}
                  style={{
                    marginTop: 16, width: "100%", background: "none", border: "none",
                    fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  ← Back to Google / email sign-in
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 28, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            ["LinkedIn", "https://linkedin.com/in/neverest/"],
            ["Telegram", "https://t.me/TNT3ME"],
            ["Email", "mailto:trinath.connect@proton.me"],
          ].map(([label, href]) => (
            <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={{
              fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.18)", textDecoration: "none",
            }}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 8, fontSize: 12,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "rgba(255,255,255,0.7)",
    }}>
      {children}
    </div>
  );
}
