import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { getMembers, getEvents, upsertMember, upsertEvent, deleteEventDB } from './supabase'

/* ── constants ── */
export const ADMIN_PASSWORD = "estate2025"
export const COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#1DD1A1","#FF9FF3","#54A0FF","#5F27CD","#00D2D3","#FF6348","#7BED9F","#70A1FF","#FFA502","#2ED573","#FF4757","#A29BFE","#FD79A8","#FDCB6E","#6C5CE7","#00CEC9"]
export const EMOJIS = ["🏖️","⛵","🍕","🎉","🌊","🍹","🎸","🏄","🌅","🎊","🍦","🏕️","🎆","🥂","🌴"]
const MONTHS = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"]
const WEEK   = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"]

/* ── utils ── */
const ini      = n => n.trim().split(" ").filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,2)
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
const fmtDate  = s => new Date(s+"T12:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})
const fmtShort = s => new Date(s+"T12:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"short"})
const daysIn   = (m,y) => new Date(y,m+1,0).getDate()
const firstWd  = (m,y) => (new Date(y,m,1).getDay()+6)%7

/* ── style helpers ── */
const BG       = "linear-gradient(160deg,#0a1628 0%,#0d2b4e 40%,#0a3d62 100%)"
const ADMIN_BG = "linear-gradient(160deg,#1a0a28 0%,#2d0d4e 40%,#3d0a62 100%)"
const GREEN_BG = "linear-gradient(160deg,#0a2a1a 0%,#0a3d2a 50%,#083d20 100%)"

const card = (ex={}) => ({
  background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)",
  borderRadius:20, padding:20, backdropFilter:"blur(12px)", marginBottom:16, ...ex
})
const btn = (v="primary") => ({
  padding:"12px 20px", borderRadius:12, border:"none",
  fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:"pointer", transition:"all .18s",
  ...(v==="primary" ? {background:"linear-gradient(135deg,#48dbfb,#1dd1a1)",color:"#0a1628"}
    : v==="ghost"   ? {background:"rgba(255,255,255,.08)",color:"#e8f4fd",border:"1px solid rgba(255,255,255,.15)"}
    : v==="danger"  ? {background:"rgba(255,107,107,.15)",color:"#ff6b6b",border:"1px solid rgba(255,107,107,.3)"}
    : v==="amber"   ? {background:"linear-gradient(135deg,#feca57,#ff9f43)",color:"#0a1628"}
    : v==="purple"  ? {background:"linear-gradient(135deg,#a29bfe,#6c5ce7)",color:"#fff"} : {})
})
const inp = {
  width:"100%", padding:"12px 16px", background:"rgba(255,255,255,.07)",
  border:"1px solid rgba(255,255,255,.15)", borderRadius:12, color:"#e8f4fd",
  fontFamily:"'DM Sans',sans-serif", fontSize:15, outline:"none", boxSizing:"border-box"
}
const glow = (x,y,c) => ({
  position:"fixed", width:400, height:400, borderRadius:"50%",
  background:c, filter:"blur(120px)", opacity:.15, left:x, top:y, pointerEvents:"none", zIndex:0
})
const wrap = (bg=BG) => ({
  minHeight:"100vh", background:bg, color:"#e8f4fd", position:"relative", overflow:"hidden",
  fontFamily:"'DM Sans',sans-serif"
})
const inner = { position:"relative", zIndex:1, maxWidth:480, margin:"0 auto", padding:"0 16px 100px" }

/* ── Avatar ── */
function Avatar({ name, color, size=32 }) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontWeight:700,fontSize:size*.36,border:"2px solid rgba(255,255,255,.3)"}}>
      {ini(name)}
    </div>
  )
}

/* ── QR Canvas ── */
function QRCanvas({ text, size=200 }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current || !text) return
    QRCode.toCanvas(ref.current, text, {
      width: size, margin: 1,
      color: { dark: "#0a1628", light: "#fffef7" }
    })
  }, [text, size])
  return <canvas ref={ref} style={{borderRadius:8}}/>
}

/* ── Spinner ── */
function Spinner() {
  return (
    <div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:52}}>🌊</div>
      <div style={{fontSize:14,color:"rgba(232,244,253,.4)"}}>Caricamento...</div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   CHECK-IN PAGE
══════════════════════════════════════════════ */
function CheckInPage() {
  const [members, setMembers] = useState([])
  const [events,  setEvents]  = useState([])
  const [step,    setStep]    = useState("pick")
  const [search,  setSearch]  = useState("")
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(true)
  const today = todayStr()

  useEffect(() => {
    (async () => {
      const [m,e] = await Promise.all([getMembers(), getEvents()])
      setMembers(m); setEvents(e); setLoading(false)
    })()
  }, [])

  const filtered = members.filter(m =>
    search.trim() === "" || m.name.toLowerCase().includes(search.toLowerCase())
  )

  async function doCheckin(member) {
    let evList = [...events]
    let omb = evList.find(e => e.is_ombrellone && e.date === today)
    if (!omb) {
      omb = { id:"omb_"+today, is_ombrellone:true, title:"Ombrellone",
        date:today, emoji:"🏖️", description:"", created_by:"system", attendees:[] }
      await upsertEvent(omb)
      evList = [...evList, omb]
    }
    const already = !!omb.attendees.find(a => a.id === member.id)
    if (!already) {
      const newAtt = [...omb.attendees, {id:member.id,name:member.name,color:member.color}]
      await upsertEvent({...omb, attendees:newAtt})
      setEvents(evList.map(e => e.id===omb.id ? {...e,attendees:newAtt} : e))
    }
    setResult({member, already}); setStep("done")
  }

  if (loading) return <Spinner/>

  if (step === "done" && result) return (
    <div style={{minHeight:"100vh",background:GREEN_BG,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{textAlign:"center",maxWidth:340,animation:"fadein .4s ease"}}>
        <div style={{fontSize:80,marginBottom:12,animation:"pop .5s ease forwards"}}>
          {result.already ? "😄" : "✅"}
        </div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,marginBottom:8,
          background:"linear-gradient(135deg,#1dd1a1,#feca57)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {result.already ? "Già registrato!" : "Eccoti!"}
        </div>
        <div style={{fontSize:16,color:"rgba(232,255,244,.75)",marginBottom:4}}>
          {result.already ? `${result.member.name}, eri già segnato/a oggi 🙌` : `Presenza segnata per ${result.member.name} 🎉`}
        </div>
        <div style={{fontSize:13,color:"rgba(232,255,244,.35)",marginBottom:32}}>{fmtDate(today)}</div>
        <button onClick={()=>{setStep("pick");setSearch("")}}
          style={{padding:"12px 28px",borderRadius:12,border:"none",cursor:"pointer",
            background:"rgba(255,255,255,.1)",color:"#e8f4fd",fontWeight:700,fontSize:14}}>
          ← Torna
        </button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:"100vh",background:GREEN_BG,color:"#e8f4fd",padding:"0 16px 40px"}}>
      <div style={{maxWidth:420,margin:"0 auto"}}>
        <div style={{textAlign:"center",padding:"40px 0 24px"}}>
          <div style={{fontSize:56,marginBottom:8}}>🏖️</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,marginBottom:4,
            background:"linear-gradient(135deg,#1dd1a1,#feca57)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Chi c'è oggi?
          </div>
          <div style={{fontSize:13,color:"rgba(232,255,244,.4)"}}>{fmtDate(today)}</div>
        </div>

        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Cerca il tuo nome…"
          style={{width:"100%",padding:"12px 16px",background:"rgba(255,255,255,.08)",
            border:"1px solid rgba(255,255,255,.15)",borderRadius:14,color:"#e8f4fd",
            fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:14}}/>

        {search.trim() !== "" && filtered.length === 0 && (
          <div style={{textAlign:"center",color:"rgba(232,255,244,.4)",fontSize:14,padding:"16px 0"}}>
            Nessun risultato. Registrati prima nell'app! 👋
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(m => {
            const omb = events.find(e => e.is_ombrellone && e.date === today)
            const present = !!omb?.attendees?.find(a => a.id === m.id)
            return (
              <button key={m.id} onClick={()=>doCheckin(m)} style={{
                display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,
                border:"none",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif",
                background:present?"rgba(29,209,161,.12)":"rgba(255,255,255,.06)",
                borderLeft:present?"4px solid #1dd1a1":"4px solid transparent"}}>
                <Avatar name={m.name} color={m.color} size={42}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:16,color:"#e8f4fd"}}>{m.name}</div>
                  {present && <div style={{fontSize:12,color:"#1dd1a1",marginTop:2}}>✓ Già presente oggi</div>}
                </div>
                <span style={{fontSize:22}}>{present ? "☀️" : "👋"}</span>
              </button>
            )
          })}
        </div>

        {members.length === 0 && (
          <div style={{textAlign:"center",color:"rgba(232,255,244,.3)",fontSize:14,padding:"40px 0"}}>
            Nessun membro registrato.<br/>Aprite prima l'app!
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  const isCheckin = new URLSearchParams(window.location.search).has("checkin")
  if (isCheckin) return <CheckInPage/>

  const [view,    setView]    = useState("login")
  const [user,    setUser]    = useState(null)
  const [members, setMembers] = useState([])
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const [nameInput,      setNameInput]      = useState("")
  const [adminPwInput,   setAdminPwInput]   = useState("")
  const [adminPwError,   setAdminPwError]   = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  const [selMonth, setSelMonth] = useState(new Date().getMonth())
  const [selYear,  setSelYear]  = useState(new Date().getFullYear())
  const [selEvent, setSelEvent] = useState(null)
  const [adminEvent, setAdminEvent] = useState(null)

  const [newTitle, setNewTitle] = useState("")
  const [newDate,  setNewDate]  = useState("")
  const [newEmoji, setNewEmoji] = useState("🏖️")
  const [newDesc,  setNewDesc]  = useState("")

  useEffect(() => {
    (async () => {
      const [m,e] = await Promise.all([getMembers(), getEvents()])
      setMembers(m); setEvents(e); setLoading(false)
    })()
  }, [])

  async function refreshEvents() {
    const e = await getEvents(); setEvents(e); return e
  }

  async function handleLogin() {
    const name = nameInput.trim(); if (!name) return
    setSaving(true)
    let m = members.find(x => x.name.toLowerCase() === name.toLowerCase())
    if (!m) {
      m = { id: Date.now().toString(), name, color: COLORS[members.length % COLORS.length] }
      await upsertMember(m)
      setMembers(prev => [...prev, m])
    }
    setUser(m); setView("calendar"); setNameInput(""); setSaving(false)
  }

  function handleAdminLogin() {
    if (adminPwInput === ADMIN_PASSWORD) {
      setUser({id:"admin",name:"Admin",color:"#feca57",isAdmin:true})
      setAdminPwInput(""); setAdminPwError(false); setShowAdminLogin(false)
      setView("admin")
    } else {
      setAdminPwError(true)
      setTimeout(() => setAdminPwError(false), 1500)
    }
  }

  async function handleAddEvent() {
    if (!newTitle.trim() || !newDate) return
    setSaving(true)
    const ev = { id:Date.now().toString(), title:newTitle.trim(), date:newDate,
      emoji:newEmoji, description:newDesc.trim(), created_by:user.id,
      is_ombrellone:false,
      attendees: user.isAdmin ? [] : [{id:user.id,name:user.name,color:user.color}] }
    await upsertEvent(ev)
    await refreshEvents()
    setNewTitle(""); setNewDate(""); setNewEmoji("🏖️"); setNewDesc("")
    setSaving(false)
    setView(user.isAdmin ? "admin" : "calendar")
  }

  async function togglePresence(eid, forUser=user) {
    setSaving(true)
    const ev = events.find(e => e.id === eid); if (!ev) return
    const att = ev.attendees || []
    const has = att.find(a => a.id === forUser.id)
    const newAtt = has ? att.filter(a => a.id !== forUser.id) : [...att, {id:forUser.id,name:forUser.name,color:forUser.color}]
    await upsertEvent({...ev, attendees:newAtt})
    const fresh = await refreshEvents()
    if (selEvent?.id === eid)   setSelEvent(fresh.find(e => e.id === eid))
    if (adminEvent?.id === eid) setAdminEvent(fresh.find(e => e.id === eid))
    setSaving(false)
  }

  async function adminToggleMember(ev, member) {
    setSaving(true)
    const att = ev.attendees || []
    const has = att.find(a => a.id === member.id)
    const newAtt = has ? att.filter(a => a.id !== member.id) : [...att, {id:member.id,name:member.name,color:member.color}]
    await upsertEvent({...ev, attendees:newAtt})
    const fresh = await refreshEvents()
    setAdminEvent(fresh.find(e => e.id === ev.id))
    setSaving(false)
  }

  async function handleDeleteEvent(id) {
    setSaving(true)
    await deleteEventDB(id)
    await refreshEvents()
    setSelEvent(null); setAdminEvent(null); setSaving(false)
    if (view === "admin-event") setView("admin")
  }

  async function ensureOmbrellone(date) {
    let ev = events.find(e => e.is_ombrellone && e.date === date)
    if (!ev) {
      ev = { id:"omb_"+date, is_ombrellone:true, title:"Ombrellone", date,
        emoji:"🏖️", description:"", created_by:"admin", attendees:[] }
      await upsertEvent(ev)
      await refreshEvents()
    }
    return ev
  }

  const qrUrl = `${window.location.origin}${window.location.pathname}?checkin=1`

  const SavingBadge = saving && (
    <div style={{position:"fixed",top:16,right:16,zIndex:100,
      background:"rgba(72,219,251,.15)",border:"1px solid rgba(72,219,251,.3)",
      borderRadius:20,padding:"6px 14px",fontSize:13,color:"#48dbfb"}}>
      💾 Salvataggio...
    </div>
  )

  if (loading) return <Spinner/>

  /* ══ LOGIN ══ */
  if (view === "login") return (
    <div style={wrap()}>
      <div style={glow("60%","5%","#48dbfb")}/><div style={glow("-10%","50%","#ff9ff3")}/>
      <div style={{...inner,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:64,marginBottom:12}}>🏖️</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,letterSpacing:"-1px",marginBottom:8,
            background:"linear-gradient(135deg,#48dbfb,#ff9ff3)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Eventi Fedo's
          </div>
          <div style={{color:"rgba(232,244,253,.5)",fontSize:15}}>Il calendario della vostra estate 🌴</div>
        </div>

        {!showAdminLogin ? (<>
          <div style={{...card(),width:"100%"}}>
            <div style={{fontWeight:700,marginBottom:12,fontSize:16}}>Come ti chiami?</div>
            <input style={inp} placeholder="Es. Marco Rossi" value={nameInput}
              onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
            <button style={{...btn("primary"),width:"100%",marginTop:12}} onClick={handleLogin} disabled={saving}>
              {saving ? "..." : "Entra 🎉"}
            </button>
          </div>
          {members.length > 0 && (
            <div style={{...card(),width:"100%"}}>
              <div style={{fontSize:13,color:"rgba(232,244,253,.4)",marginBottom:10}}>Chi c'è già — tocca per selezionare</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {members.map(m => (
                  <div key={m.id} onClick={()=>setNameInput(m.name)}
                    style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.06)",
                      borderRadius:20,padding:"4px 10px 4px 4px",cursor:"pointer"}}>
                    <Avatar name={m.name} color={m.color} size={24}/>
                    <span style={{fontSize:13}}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={()=>setShowAdminLogin(true)}
            style={{...btn("ghost"),fontSize:13,padding:"8px 16px",marginTop:4,opacity:.6}}>
            🔐 Accesso admin
          </button>
        </>) : (
          <div style={{...card({border:adminPwError?"1px solid rgba(255,107,107,.5)":"1px solid rgba(162,155,254,.3)",
            background:"rgba(108,92,231,.08)"}),width:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <span style={{fontSize:22}}>🔐</span>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>Accesso Admin</div>
            </div>
            <input style={{...inp,borderColor:adminPwError?"rgba(255,107,107,.5)":undefined}}
              type="password" placeholder="Password admin" value={adminPwInput}
              onChange={e=>setAdminPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
            {adminPwError && <div style={{color:"#ff6b6b",fontSize:13,marginTop:6}}>Password errata ❌</div>}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button style={{...btn("ghost"),flex:1}} onClick={()=>{setShowAdminLogin(false);setAdminPwInput("")}}>Annulla</button>
              <button style={{...btn("purple"),flex:1}} onClick={handleAdminLogin}>Entra</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  /* ══ ADMIN PANEL ══ */
  if (view === "admin") {
    const ombEvents   = events.filter(e=>e.is_ombrellone).sort((a,b)=>b.date.localeCompare(a.date))
    const otherEvents = events.filter(e=>!e.is_ombrellone).sort((a,b)=>b.date.localeCompare(a.date))
    return (
      <div style={wrap(ADMIN_BG)}>
        {SavingBadge}
        <div style={glow("60%","5%","#a29bfe")}/><div style={glow("-10%","60%","#feca57")}/>
        <div style={inner}>
          <div style={{padding:"20px 0 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#a29bfe,#6c5ce7)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👑</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,lineHeight:1.2}}>Admin</div>
                <div style={{fontSize:11,color:"rgba(232,244,253,.4)"}}>Pannello di controllo</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...btn("amber"),padding:"8px 12px",fontSize:13}} onClick={()=>setView("qr")}>📷 QR</button>
              <button style={{...btn("ghost"),padding:"8px 12px",fontSize:13}} onClick={()=>{setUser(null);setView("login")}}>Esci</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[["👥",members.length,"Membri"],["📅",events.length,"Eventi"],["🏖️",ombEvents.length,"Giornate"]].map(([em,n,label])=>(
              <div key={label} style={{...card({padding:"14px 12px",textAlign:"center",marginBottom:0})}}>
                <div style={{fontSize:20,marginBottom:4}}>{em}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>{n}</div>
                <div style={{fontSize:11,color:"rgba(232,244,253,.4)"}}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button style={{...btn("primary"),flex:1}} onClick={()=>setView("add-event")}>+ Nuovo evento</button>
            <button style={{...btn("purple"),flex:1}} onClick={async()=>{
              const omb = await ensureOmbrellone(todayStr())
              setAdminEvent(omb); setView("admin-event")
            }}>🏖️ Gestisci oggi</button>
          </div>

          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,marginBottom:10}}>Giornate all'ombrellone</div>
          {ombEvents.length===0 && <div style={{...card({textAlign:"center",color:"rgba(232,244,253,.3)",fontSize:14})}}>Nessuna giornata ancora</div>}
          {ombEvents.map(ev => (
            <div key={ev.id} style={{...card({display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:10})}}
              onClick={()=>{setAdminEvent(ev);setView("admin-event")}}>
              <span style={{fontSize:26}}>🏖️</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{fmtDate(ev.date)}</div>
                <div style={{fontSize:12,color:"rgba(232,244,253,.45)",marginTop:2}}>{ev.attendees?.length||0} presenti</div>
              </div>
              <div style={{display:"flex",flexDirection:"row-reverse"}}>
                {(ev.attendees||[]).slice(0,4).map((a,i)=>(
                  <div key={a.id} style={{marginLeft:i>0?-8:0}}><Avatar name={a.name} color={a.color} size={26}/></div>
                ))}
              </div>
              <span style={{color:"rgba(232,244,253,.4)",fontSize:18}}>›</span>
            </div>
          ))}

          {otherEvents.length > 0 && <>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,marginBottom:10,marginTop:8}}>Altri eventi</div>
            {otherEvents.map(ev => (
              <div key={ev.id} style={{...card({display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:10})}}
                onClick={()=>{setAdminEvent(ev);setView("admin-event")}}>
                <span style={{fontSize:26}}>{ev.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{ev.title}</div>
                  <div style={{fontSize:12,color:"rgba(232,244,253,.45)",marginTop:2}}>{fmtShort(ev.date)} · {ev.attendees?.length||0} presenti</div>
                </div>
                <span style={{color:"rgba(232,244,253,.4)",fontSize:18}}>›</span>
              </div>
            ))}
          </>}

          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,marginBottom:10,marginTop:8}}>Membri ({members.length})</div>
          <div style={card()}>
            {members.length===0 && <div style={{color:"rgba(232,244,253,.3)",fontSize:14,textAlign:"center"}}>Nessun membro</div>}
            {members.map((m,i)=>(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",
                borderBottom:i<members.length-1?"1px solid rgba(255,255,255,.07)":"none"}}>
                <Avatar name={m.name} color={m.color} size={32}/>
                <div style={{flex:1,fontWeight:600,fontSize:14}}>{m.name}</div>
                <div style={{fontSize:12,color:"rgba(232,244,253,.35)"}}>
                  {events.filter(e=>e.attendees?.find(a=>a.id===m.id)).length} eventi
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ══ ADMIN EVENT EDITOR ══ */
  if (view === "admin-event" && adminEvent) {
    const ev = events.find(e=>e.id===adminEvent.id) || adminEvent
    return (
      <div style={wrap(ADMIN_BG)}>
        {SavingBadge}
        <div style={glow("60%","5%","#a29bfe")}/><div style={glow("-10%","60%","#feca57")}/>
        <div style={inner}>
          <div style={{padding:"24px 0 16px",display:"flex",alignItems:"center",gap:12}}>
            <button style={{...btn("ghost"),padding:"8px 14px",fontSize:14}} onClick={()=>setView("admin")}>← Indietro</button>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>Gestisci presenze</div>
          </div>

          <div style={{...card({background:"rgba(162,155,254,.08)",border:"1px solid rgba(162,155,254,.25)"})}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:30}}>{ev.emoji}</span>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>{ev.title}</div>
                <div style={{fontSize:13,color:"rgba(232,244,253,.5)"}}>{fmtDate(ev.date)}</div>
              </div>
            </div>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:8}}>
              Presenti: <strong style={{color:"#a29bfe"}}>{ev.attendees?.length||0}</strong> / {members.length}
            </div>
            <div style={{height:6,background:"rgba(255,255,255,.1)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,transition:"width .3s",
                width:`${members.length ? Math.round((ev.attendees?.length||0)/members.length*100) : 0}%`,
                background:"linear-gradient(90deg,#a29bfe,#48dbfb)"}}/>
            </div>
          </div>

          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,marginBottom:10}}>Aggiungi / rimuovi presenze</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {members.map(m => {
              const present = !!ev.attendees?.find(a=>a.id===m.id)
              return (
                <div key={m.id} onClick={()=>adminToggleMember(ev,m)} style={{
                  display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,cursor:"pointer",
                  background:present?"rgba(29,209,161,.12)":"rgba(255,255,255,.05)",
                  border:present?"1px solid rgba(29,209,161,.3)":"1px solid rgba(255,255,255,.1)",transition:"all .15s"}}>
                  <Avatar name={m.name} color={m.color} size={38}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15}}>{m.name}</div>
                    <div style={{fontSize:12,color:present?"#1dd1a1":"rgba(232,244,253,.35)",marginTop:2}}>
                      {present?"✓ Presente":"Assente"}
                    </div>
                  </div>
                  <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                    background:present?"rgba(29,209,161,.2)":"rgba(255,255,255,.08)",
                    border:present?"2px solid #1dd1a1":"2px solid rgba(255,255,255,.2)"}}>
                    {present?"✓":""}
                  </div>
                </div>
              )
            })}
          </div>
          <button style={{...btn("danger"),width:"100%"}} onClick={()=>handleDeleteEvent(ev.id)}>🗑️ Elimina evento</button>
        </div>
      </div>
    )
  }

  /* ══ QR PAGE ══ */
  if (view === "qr") {
    const omb = events.find(e=>e.is_ombrellone&&e.date===todayStr())
    return (
      <div style={wrap(user?.isAdmin ? ADMIN_BG : BG)}>
        <div style={glow("30%","5%","#feca57")}/><div style={glow("60%","60%","#1dd1a1")}/>
        <div style={inner}>
          <div style={{padding:"24px 0 16px",display:"flex",alignItems:"center",gap:12}}>
            <button style={{...btn("ghost"),padding:"8px 14px",fontSize:14}} onClick={()=>setView(user?.isAdmin?"admin":"calendar")}>← Indietro</button>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20}}>QR Ombrellone</div>
          </div>

          <div style={{...card({background:"rgba(255,236,100,.06)",border:"1px solid rgba(254,202,87,.3)",textAlign:"center",padding:28})}}>
            <div style={{fontSize:40,marginBottom:6}}>🏖️</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:4,color:"#feca57"}}>Segna la presenza</div>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:20}}>Scansiona con la fotocamera del telefono</div>
            <div style={{display:"inline-block",background:"#fffef7",padding:16,borderRadius:16,marginBottom:16}}>
              <QRCanvas text={qrUrl} size={180}/>
            </div>
            <div style={{fontSize:10,color:"rgba(232,244,253,.25)",wordBreak:"break-all",marginTop:4}}>{qrUrl}</div>
          </div>

          <div style={card()}>
            <div style={{fontWeight:700,marginBottom:12,fontSize:15}}>Come funziona 📋</div>
            {[["1️⃣","Stampa questo QR o lascia questa schermata aperta"],
              ["2️⃣","Appendilo all'ombrellone o mettilo sul tavolo"],
              ["3️⃣","Ogni persona lo scansiona con la fotocamera"],
              ["4️⃣","Seleziona il proprio nome e la presenza è segnata!"]].map(([em,txt])=>(
              <div key={em} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                <span style={{fontSize:18,lineHeight:"1.4"}}>{em}</span>
                <span style={{fontSize:14,color:"rgba(232,244,253,.7)",lineHeight:1.4}}>{txt}</span>
              </div>
            ))}
          </div>

          {omb?.attendees?.length > 0 ? (
            <div style={card()}>
              <div style={{fontWeight:700,marginBottom:12,fontSize:15}}>
                Oggi all'ombrellone ☀️ <span style={{fontWeight:400,color:"rgba(232,244,253,.4)",fontSize:13}}>({omb.attendees.length})</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {omb.attendees.map(a=>(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:6,
                    background:"rgba(29,209,161,.1)",border:"1px solid rgba(29,209,161,.25)",
                    borderRadius:20,padding:"4px 12px 4px 6px"}}>
                    <Avatar name={a.name} color={a.color} size={24}/>
                    <span style={{fontSize:13,fontWeight:600}}>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{...card({textAlign:"center",color:"rgba(232,244,253,.3)",fontSize:14})}}>Nessuno ancora oggi ☀️</div>
          )}
        </div>
      </div>
    )
  }

  /* ══ ADD EVENT ══ */
  if (view === "add-event") return (
    <div style={wrap(user?.isAdmin ? ADMIN_BG : BG)}>
      {SavingBadge}
      <div style={glow("60%","5%","#feca57")}/>
      <div style={inner}>
        <div style={{padding:"24px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button style={{...btn("ghost"),padding:"8px 14px",fontSize:14}} onClick={()=>setView(user?.isAdmin?"admin":"calendar")}>← Indietro</button>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>Nuovo Evento</div>
          <div style={{width:80}}/>
        </div>
        <div style={card()}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:6}}>Titolo *</div>
            <input style={inp} placeholder="Es. Pizza sul lungomare" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:6}}>Data *</div>
            <input style={{...inp,colorScheme:"dark"}} type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:8}}>Emoji</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {EMOJIS.map(em=>(
                <button key={em} onClick={()=>setNewEmoji(em)} style={{fontSize:20,
                  background:em===newEmoji?"rgba(72,219,251,.2)":"rgba(255,255,255,.05)",
                  border:em===newEmoji?"2px solid #48dbfb":"2px solid transparent",
                  borderRadius:10,width:38,height:38,cursor:"pointer"}}>
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,color:"rgba(232,244,253,.5)",marginBottom:6}}>Descrizione</div>
            <textarea style={{...inp,resize:"vertical",minHeight:72}} placeholder="Dove, a che ora, cosa portare..."
              value={newDesc} onChange={e=>setNewDesc(e.target.value)}/>
          </div>
          <button style={{...btn("primary"),width:"100%"}} onClick={handleAddEvent} disabled={saving}>
            {saving ? "Salvataggio..." : "Crea Evento 🎉"}
          </button>
        </div>
      </div>
    </div>
  )

  /* ══ CALENDAR ══ */
  const days   = daysIn(selMonth, selYear)
  const firstD = firstWd(selMonth, selYear)
  const today  = new Date()
  const monthEvents = events
    .filter(e=>{ const [y,m]=e.date.split("-").map(Number); return y===selYear&&m===selMonth+1 })
    .sort((a,b)=>a.date.localeCompare(b.date))

  return (
    <div style={wrap()}>
      {SavingBadge}
      <div style={glow("70%","-5%","#48dbfb")}/><div style={glow("-10%","60%","#1dd1a1")}/>
      <div style={inner}>
        <div style={{padding:"20px 0 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Avatar name={user.name} color={user.color} size={36}/>
            <div>
              <div style={{fontWeight:700,fontSize:15,lineHeight:1.2}}>{user.name}</div>
              <div style={{fontSize:11,color:"rgba(232,244,253,.4)"}}>{members.length} nella compagnia</div>
            </div>
          </div>
          <button style={{...btn("ghost"),padding:"8px 12px",fontSize:13}} onClick={()=>{setUser(null);setView("login")}}>Esci</button>
        </div>

        <div style={{...card({display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px"})}}>
          <button style={{background:"none",border:"none",color:"#e8f4fd",fontSize:22,cursor:"pointer",padding:4}}
            onClick={()=>{if(selMonth===0){setSelMonth(11);setSelYear(y=>y-1)}else setSelMonth(m=>m-1)}}>‹</button>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20}}>{MONTHS[selMonth]} {selYear}</div>
          <button style={{background:"none",border:"none",color:"#e8f4fd",fontSize:22,cursor:"pointer",padding:4}}
            onClick={()=>{if(selMonth===11){setSelMonth(0);setSelYear(y=>y+1)}else setSelMonth(m=>m+1)}}>›</button>
        </div>

        <div style={card()}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
            {WEEK.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"rgba(232,244,253,.35)",padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {Array.from({length:firstD}).map((_,i)=><div key={"e"+i}/>)}
            {Array.from({length:days}).map((_,i)=>{
              const day = i+1
              const ds  = `${selYear}-${String(selMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
              const dayEvs  = events.filter(e=>e.date===ds)
              const isToday = today.getDate()===day&&today.getMonth()===selMonth&&today.getFullYear()===selYear
              return (
                <div key={day} onClick={()=>dayEvs.length===1&&setSelEvent(dayEvs[0])}
                  style={{minHeight:50,borderRadius:10,padding:"4px 3px",
                    background:isToday?"rgba(72,219,251,.15)":"rgba(255,255,255,.04)",
                    border:isToday?"1px solid rgba(72,219,251,.4)":"1px solid rgba(255,255,255,.06)",
                    cursor:dayEvs.length>0?"pointer":"default"}}>
                  <div style={{fontSize:11,fontWeight:isToday?700:500,
                    color:isToday?"#48dbfb":"rgba(232,244,253,.6)",textAlign:"center",marginBottom:2}}>{day}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:1,justifyContent:"center"}}>
                    {dayEvs.slice(0,3).map(ev=>(
                      <div key={ev.id} onClick={e=>{e.stopPropagation();setSelEvent(ev)}} style={{fontSize:12,cursor:"pointer"}}>{ev.emoji}</div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selEvent && (()=>{
          const ev = events.find(e=>e.id===selEvent.id)||selEvent
          const iAtt = ev.attendees?.find(a=>a.id===user.id)
          const creator = members.find(m=>m.id===ev.created_by)
          return (
            <div style={{...card({borderColor:"rgba(72,219,251,.25)"})}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:30}}>{ev.emoji}</span>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>{ev.title}</div>
                    <div style={{fontSize:13,color:"rgba(232,244,253,.5)"}}>{fmtDate(ev.date)}</div>
                  </div>
                </div>
                <button onClick={()=>setSelEvent(null)} style={{background:"none",border:"none",color:"rgba(232,244,253,.4)",fontSize:20,cursor:"pointer"}}>✕</button>
              </div>
              {ev.description && <div style={{fontSize:14,color:"rgba(232,244,253,.6)",marginBottom:12,lineHeight:1.5}}>{ev.description}</div>}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"rgba(232,244,253,.4)",marginBottom:8}}>Presenti ({ev.attendees?.length||0})</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(ev.attendees||[]).map(a=>(
                    <div key={a.id} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,.05)",borderRadius:20,padding:"3px 10px 3px 4px"}}>
                      <Avatar name={a.name} color={a.color} size={20}/>
                      <span style={{fontSize:12}}>{a.name}</span>
                    </div>
                  ))}
                  {!ev.attendees?.length && <span style={{fontSize:13,color:"rgba(232,244,253,.3)"}}>Nessuno ancora</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...btn(iAtt?"ghost":"primary"),flex:1}} onClick={()=>togglePresence(ev.id)} disabled={saving}>
                  {iAtt?"❌ Rimuovi presenza":"✅ Ci sono!"}
                </button>
                {ev.created_by===user.id && (
                  <button style={{...btn("danger"),padding:"12px 14px"}} onClick={()=>handleDeleteEvent(ev.id)}>🗑️</button>
                )}
              </div>
              {creator && <div style={{fontSize:12,color:"rgba(232,244,253,.3)",marginTop:10,textAlign:"right"}}>Creato da {creator.name}</div>}
            </div>
          )
        })()}

        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,marginBottom:12}}>{MONTHS[selMonth]}</div>
        {monthEvents.length===0 && <div style={{textAlign:"center",color:"rgba(232,244,253,.3)",fontSize:14,padding:"20px 0"}}>Nessun evento questo mese</div>}
        {monthEvents.map(ev=>{
          const iAtt = ev.attendees?.find(a=>a.id===user.id)
          return (
            <div key={ev.id} onClick={()=>setSelEvent(ev)}
              style={{...card({display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:10,
                borderColor:iAtt?"rgba(29,209,161,.3)":"rgba(255,255,255,.08)"})}}>
              <span style={{fontSize:26}}>{ev.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{ev.title}</div>
                <div style={{fontSize:12,color:"rgba(232,244,253,.45)"}}>{fmtShort(ev.date)} · {ev.attendees?.length||0} presenti</div>
              </div>
              {iAtt && <span style={{fontSize:12,fontWeight:700,color:"#1dd1a1",
                background:"rgba(29,209,161,.1)",border:"1px solid rgba(29,209,161,.3)",
                borderRadius:20,padding:"3px 10px",flexShrink:0}}>✓ Ci sono</span>}
            </div>
          )
        })}
      </div>

      <div style={{position:"fixed",bottom:24,right:24,zIndex:10}}>
        <button onClick={()=>setView("add-event")} style={{
          width:56,height:56,borderRadius:"50%",border:"none",cursor:"pointer",
          background:"linear-gradient(135deg,#48dbfb,#1dd1a1)",
          boxShadow:"0 4px 24px rgba(72,219,251,.4)",fontSize:26,
          display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
      </div>
    </div>
  )
}
