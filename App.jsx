import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {randomScrambleForEvent} from "cubing/scramble";
import {EVENTS, DEFAULT_STATS} from "./events";
import {supabase} from "./supabase";
import {slugify,formatTime,computeAverage,levelFor,downloadJson} from "./utils";

const EMPTY_PROFILE={username:"",display_name:"",bio:"",is_public:true};
const EMPTY_EVENT={id:"",name:""};
const EMPTY_STAT={event_id:"333",stat_type:"single",label:"Single",unit:"s",visible_on_profile:true,included_in_rankings:true};
const EMPTY_LEVEL={event_id:"333",stat_type:"ao5",level_name:"Sub-20",max_value:"20",sort_order:"1"};
const STAT_TYPES=["single","mean3","ao5","ao12","ao100"];
const timeFmt = ms => `${(Number(ms)/1000).toFixed(2)} s`;

export default function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[admin,setAdmin]=useState(false);
 const [tab,setTab]=useState("timer"),[notice,setNotice]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[username,setUsername]=useState("");
 const [profileForm,setProfileForm]=useState(EMPTY_PROFILE);
 const [events,setEvents]=useState(EVENTS),[stats,setStats]=useState([]),[thresholds,setThresholds]=useState([]);
 const [solves,setSolves]=useState([]),[publicProfile,setPublicProfile]=useState(null),[publicSolves,setPublicSolves]=useState([]);
 const [rankings,setRankings]=useState([]),[rankEvent,setRankEvent]=useState("333"),[rankStat,setRankStat]=useState("single");
 const [eventForm,setEventForm]=useState(EMPTY_EVENT),[statForm,setStatForm]=useState(EMPTY_STAT),[levelForm,setLevelForm]=useState(EMPTY_LEVEL);
 const [editSolve,setEditSolve]=useState(null),[recordForm,setRecordForm]=useState({event_id:"333",stat_type:"single",value:"",penalty:"none",scramble:""});
 const [eventId,setEventId]=useState("333"),[scramble,setScramble]=useState("Chargement…"),[running,setRunning]=useState(false),[startedAt,setStartedAt]=useState(0),[elapsed,setElapsed]=useState(0),[timerSolves,setTimerSolves]=useState([]);
 const [profileSearch,setProfileSearch]=useState("");
 const [theme,setTheme]=useState(localStorage.getItem("cubestats-theme")||"dark");
 const raf=useRef(null),fileInput=useRef(null);
 const activeEvents=useMemo(()=>events.filter(e=>e.is_active),[events]);
 const eventName=id=>events.find(e=>e.id===id)?.name||id;
 const notify=t=>setNotice(t);

 const refreshAccount=useCallback(async(s)=>{
   setSession(s);
   if(!s?.user){setProfile(null);setAdmin(false);setSolves([]);return;}
   const [{data:p,error:pe},{data:a,error:ae}]=await Promise.all([
     supabase.from("profiles").select("*").eq("id",s.user.id).maybeSingle(),
     supabase.from("admin_users").select("user_id").eq("user_id",s.user.id).maybeSingle()
   ]);
   if(pe)notify("Chargement profil : "+pe.message);
   setProfile(p||null);setAdmin(!!a&&!ae);
   if(p)setProfileForm({username:p.username||"",display_name:p.display_name||"",bio:p.bio||"",is_public:p.is_public});
   await loadOwnSolves(s.user.id);
 },[]);
 async function loadOwnSolves(uid){
   const {data,error}=await supabase.from("solves").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(500);
   if(error)notify(error.message);else setSolves(data||[]);
 }
 async function loadCatalogue(){
   if(!supabase)return;
   const [{data:e,error:ee},{data:s,error:se},{data:l,error:le}]=await Promise.all([
     supabase.from("events").select("*").order("sort_order"),
     supabase.from("event_stats").select("*").order("event_id"),
     supabase.from("level_thresholds").select("*").order("event_id").order("stat_type").order("sort_order")
   ]);
   if(ee)notify(ee.message);else if(e?.length)setEvents(e);
   if(se)notify(se.message);else setStats(s||[]);
   if(le)notify(le.message);else setThresholds(l||[]);
 }
 useEffect(()=>{
   if(!supabase)return;
   supabase.auth.getSession().then(({data})=>refreshAccount(data.session));
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setTimeout(()=>refreshAccount(s),0));
   return ()=>subscription.unsubscribe();
 },[refreshAccount]);
 useEffect(()=>{if(session)loadCatalogue();},[session]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("cubestats-theme",theme);},[theme]);

 async function newScramble(id=eventId){
   setScramble("Génération…");
   try{const s=await randomScrambleForEvent(id);setScramble(s.toString());}
   catch{setScramble("Générateur indisponible pour cette discipline. Tu peux saisir un temps manuellement.");}
 }
 useEffect(()=>{newScramble(eventId);},[eventId]);
 useEffect(()=>{
   if(!running)return;
   const tick=()=>{setElapsed(performance.now()-startedAt);raf.current=requestAnimationFrame(tick);};
   raf.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf.current);
 },[running,startedAt]);
 const startTimer=()=>{setElapsed(0);setStartedAt(performance.now());setRunning(true);};
 async function stopTimer(){
   const ms=performance.now()-startedAt;setRunning(false);setElapsed(ms);
   const item={event_id:eventId,ms,scramble,created_at:new Date().toISOString()};
   setTimerSolves(v=>[item,...v]);
   if(session){
     const {error}=await supabase.from("solves").insert({user_id:session.user.id,event_id:eventId,stat_type:"single",value:ms/1000,scramble,penalty:"none"});
     if(error)notify("Temps conservé dans la session mais non synchronisé : "+error.message);
     else {notify("Temps enregistré dans ton compte.");loadOwnSolves(session.user.id);}
   }
   newScramble();
 }
 useEffect(()=>{
   const handler=e=>{if(e.code!=="Space"||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;e.preventDefault();running?stopTimer():startTimer();};
   window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
 },[running,startedAt,eventId,scramble,session]);
 async function signUp(e){
   e.preventDefault();if(!supabase){notify("Supabase n'est pas configuré.");return;}
   const clean=slugify(username);if(clean.length<3){notify("Pseudonyme : 3 caractères minimum, lettres/chiffres/_/-.");return;}
   const {error}=await supabase.auth.signUp({email,password,options:{data:{username:clean}}});
   notify(error?error.message:"Compte créé. Vérifie ton e-mail si la confirmation est activée, puis connecte-toi.");
 }
 async function signIn(e){e.preventDefault();if(!supabase){notify("Configure Supabase dans le fichier .env.");return;}const {error}=await supabase.auth.signInWithPassword({email,password});notify(error?error.message:"Connexion réussie.");}
 async function signOut(){await supabase?.auth.signOut();setSession(null);setTab("account");}
 async function saveProfile(e){
   e.preventDefault();if(!session)return;
   const payload={id:session.user.id,username:slugify(profileForm.username),display_name:profileForm.display_name.trim(),bio:profileForm.bio.trim(),is_public:profileForm.is_public};
   if(payload.username.length<3){notify("Pseudonyme trop court.");return;}
   const {data,error}=await supabase.from("profiles").upsert(payload).select().single();
   if(error)notify("Profil non enregistré : "+error.message);else{setProfile(data);notify("Profil mis à jour.");}
 }
 async function loadProfileByName(name){
   const clean=slugify(name);
   const {data:p,error}=await supabase.from("profiles").select("*").eq("username",clean).maybeSingle();
   if(error||!p){notify("Profil introuvable ou privé.");return;}
   const {data:s,error:se}=await supabase.from("solves").select("*").eq("user_id",p.id).order("created_at",{ascending:false}).limit(200);
   if(se){notify(se.message);return;}
   setPublicProfile(p);setPublicSolves(s||[]);setTab("publicProfile");
 }
 async function loadRankings(){
   if(!supabase){notify("Configure Supabase pour consulter les classements.");return;}
   const {data,error}=await supabase.from("solves").select("id,user_id,event_id,stat_type,value,penalty,created_at,profiles!inner(username,display_name,is_public)").eq("event_id",rankEvent).eq("stat_type",rankStat).eq("penalty","none").order("value",{ascending:true}).limit(100);
   if(error){notify("Classement : "+error.message);return;}
   setRankings((data||[]).filter(r=>r.profiles?.is_public));setTab("rankings");
 }
 async function addManualSolve(e){
   e.preventDefault();if(!session){notify("Connecte-toi pour enregistrer un record.");return;}
   const value=Number(recordForm.value);if(!Number.isFinite(value)||value<=0){notify("Saisis une valeur positive.");return;}
   const {error}=await supabase.from("solves").insert({user_id:session.user.id,event_id:recordForm.event_id,stat_type:recordForm.stat_type,value,penalty:recordForm.penalty,scramble:recordForm.scramble||null});
   if(error)notify(error.message);else{notify("Record ajouté.");setRecordForm({...recordForm,value:"",scramble:""});loadOwnSolves(session.user.id);}
 }
 async function saveEditedSolve(e){
   e.preventDefault();if(!editSolve)return;
   const value=Number(editSolve.value);if(!Number.isFinite(value)||value<=0){notify("Valeur invalide.");return;}
   const {error}=await supabase.from("solves").update({event_id:editSolve.event_id,stat_type:editSolve.stat_type,value,penalty:editSolve.penalty,scramble:editSolve.scramble}).eq("id",editSolve.id);
   if(error)notify(error.message);else{setEditSolve(null);loadOwnSolves(session.user.id);notify("Record modifié.");}
 }
 async function deleteSolve(id){
   if(!confirm("Supprimer ce record ?"))return;
   const {error}=await supabase.from("solves").delete().eq("id",id);
   if(error)notify(error.message);else{loadOwnSolves(session.user.id);notify("Record supprimé.");}
 }
 async function addEvent(e){
   e.preventDefault();if(!admin)return;
   const id=slugify(eventForm.id);
   if(!id||!eventForm.name.trim()){notify("Identifiant et nom obligatoires.");return;}
   const {error}=await supabase.from("events").insert({id,name:eventForm.name.trim(),is_active:true,is_official:false,sort_order:events.length+1});
   if(error)notify(error.message);else{setEventForm(EMPTY_EVENT);loadCatalogue();notify("Discipline ajoutée.");}
 }
 async function updateEvent(ev,changes){
   const {error}=await supabase.from("events").update(changes).eq("id",ev.id);
   if(error)notify(error.message);else{loadCatalogue();notify("Discipline modifiée.");}
 }
 async function deleteEvent(ev){
   if(ev.is_official){notify("Les disciplines officielles ne peuvent pas être supprimées. Désactive-les si nécessaire.");return;}
   if(!confirm(`Supprimer la discipline ${ev.name} et ses paramètres ?`))return;
   const {error}=await supabase.from("events").delete().eq("id",ev.id);
   if(error)notify(error.message);else{loadCatalogue();notify("Discipline supprimée.");}
 }
 async function addStat(e){
   e.preventDefault();const {error}=await supabase.from("event_stats").insert(statForm);
   if(error)notify(error.message);else{loadCatalogue();notify("Statistique ajoutée.");}
 }
 async function updateStat(s,changes){
   const {error}=await supabase.from("event_stats").update(changes).eq("id",s.id);
   if(error)notify(error.message);else{loadCatalogue();notify("Statistique modifiée.");}
 }
 async function deleteStat(s){
   if(!confirm(`Supprimer « ${s.label} » ?`))return;
   const {error}=await supabase.from("event_stats").delete().eq("id",s.id);
   if(error)notify(error.message);else{loadCatalogue();notify("Statistique supprimée.");}
 }
 async function addLevel(e){
   e.preventDefault();const {error}=await supabase.from("level_thresholds").insert({...levelForm,max_value:Number(levelForm.max_value),sort_order:Number(levelForm.sort_order)});
   if(error)notify(error.message);else{loadCatalogue();notify("Niveau ajouté.");}
 }
 async function deleteLevel(l){
   if(!confirm(`Supprimer le niveau ${l.level_name} ?`))return;
   const {error}=await supabase.from("level_thresholds").delete().eq("id",l.id);
   if(error)notify(error.message);else{loadCatalogue();notify("Niveau supprimé.");}
 }
 function exportData(){
   if(!session){notify("Connecte-toi pour exporter tes données.");return;}
   downloadJson("cubestats-export.json",{format:"cubestats-v1",exported_at:new Date().toISOString(),profile,solves});
 }
 async function importData(e){
   const file=e.target.files?.[0];if(!file||!session)return;
   try{
     const data=JSON.parse(await file.text());
     if(data.format!=="cubestats-v1"||!Array.isArray(data.solves))throw new Error("Fichier CubeStats invalide.");
     const rows=data.solves.map(s=>({user_id:session.user.id,event_id:s.event_id,stat_type:s.stat_type||"single",value:Number(s.value),penalty:["none","plus2","dnf"].includes(s.penalty)?s.penalty:"none",scramble:s.scramble||null,created_at:s.created_at||new Date().toISOString()}))
       .filter(s=>events.some(ev=>ev.id===s.event_id)&&Number.isFinite(s.value)&&s.value>0);
     if(!rows.length)throw new Error("Aucun record valide trouvé.");
     const {error}=await supabase.from("solves").insert(rows);
     if(error)throw error;
     await loadOwnSolves(session.user.id);notify(`${rows.length} record(s) importé(s).`);
   }catch(err){notify("Import impossible : "+err.message);}
   e.target.value="";
 }
 const currentThresholds=thresholds.filter(t=>t.event_id===rankEvent&&t.stat_type===rankStat);
 const currentStats=stats.filter(s=>s.event_id===rankEvent&&s.visible_on_profile);
 const mySessionBest=timerSolves.length?Math.min(...timerSolves.map(s=>s.ms)):null;
 const timerAo5=timerSolves.length>=5?computeAverage(timerSolves.slice(0,5).map(s=>s.ms)):null;

 return <div className="app">
  <header className="topbar"><a className="brand" href="#" onClick={()=>setTab("timer")}><span className="brand-mark">C</span>Cube<span className="accent">Stats</span></a>
   <nav>
    <button className={tab==="timer"?"active":""} onClick={()=>setTab("timer")}>Chronomètre</button>
    <button className={tab==="account"?"active":""} onClick={()=>setTab("account")}>Mon compte</button>
    <button className={tab==="records"?"active":""} onClick={()=>setTab("records")}>Mes records</button>
    <button className={tab==="rankings"?"active":""} onClick={loadRankings}>Classements</button>
    <button className={tab==="profileSearch"?"active":""} onClick={()=>setTab("profileSearch")}>Cubers</button>
    {admin&&<button className={tab==="admin"?"active":""} onClick={()=>setTab("admin")}>Admin</button>}
   </nav>
   <div className="account">{session?<><span>{profile?.username||"Membre"}</span><button className="quiet" onClick={signOut}>Quitter</button></>:<span className="pill">Visiteur</span>}</div>
  </header>
  <main>
   <section className="hero"><div><p className="eyebrow">LA COMMUNAUTÉ DU SPEEDCUBING</p><h1>Mesure tes progrès.<br/><span className="accent">Repousse tes records.</span></h1><p className="sub">Un espace indépendant pour suivre tes performances sur tes puzzles favoris.</p></div><div className="hero-cube">✣</div></section>
   {tab==="timer"&&<section className="two-col">
    <div className="panel"><p className="eyebrow">SESSION D'ENTRAÎNEMENT</p><h2>Chronomètre</h2><label className="field">Discipline<select value={eventId} onChange={e=>setEventId(e.target.value)} disabled={running}>{activeEvents.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
     <div className="scramble"><div className="scramble-head">MÉLANGE ALÉATOIRE <button className="link" onClick={()=>newScramble()} disabled={running}>Nouveau ↻</button></div>{scramble}</div>
     <button className={`timer ${running?"running":""}`} onClick={()=>running?stopTimer():startTimer()}><span>{running?timeFmt(elapsed):elapsed?timeFmt(elapsed):"0.00 s"}</span><small>{running?"CLIQUE OU ESPACE POUR ARRÊTER":"CLIQUE OU ESPACE POUR DÉMARRER"}</small></button>
     <p className="notice">Les scrambles sont générés par cubing.js lorsque la discipline est prise en charge. Chronomètre d'entraînement, non certifié pour les compétitions.</p>
    </div>
    <aside className="panel"><p className="eyebrow">CETTE SESSION</p><h2>Statistiques rapides</h2><div className="metric"><span>Résolutions</span><b>{timerSolves.length}</b></div><div className="metric"><span>Meilleur single</span><b>{mySessionBest?timeFmt(mySessionBest):"—"}</b></div><div className="metric"><span>Ao5 indicatif</span><b>{timerAo5?timeFmt(timerAo5):"—"}</b></div>{timerSolves.slice(0,8).map((s,i)=><div className="metric" key={i}><span>#{timerSolves.length-i}</span><b>{timeFmt(s.ms)}</b></div>)}</aside>
   </section>}
   {tab==="account"&&<section className="two-col">
    <div className="panel"><p className="eyebrow">ESPACE PERSONNEL</p><h2>{session?"Mon profil":"Créer un compte ou se connecter"}</h2>
     {!session?<><p className="muted">Utilise un pseudonyme. Ton adresse e-mail reste privée et n'apparaît pas sur ton profil.</p>
      <form className="form" onSubmit={signIn}><h3>Connexion</h3><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary">Se connecter</button></form>
      <form className="form separate" onSubmit={signUp}><h3>Créer un compte</h3><label>Pseudonyme<input value={username} onChange={e=>setUsername(e.target.value)} minLength="3" maxLength="24" required/></label><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="8" required/></label><button className="primary">Créer mon compte</button></form>
     </>:<><p className="muted">Ces informations sont affichées sur ton profil si celui-ci est public.</p><form className="form" onSubmit={saveProfile}><label>Pseudonyme<input value={profileForm.username} onChange={e=>setProfileForm({...profileForm,username:e.target.value})} minLength="3" maxLength="24" required/></label><label>Nom affiché (facultatif)<input value={profileForm.display_name} onChange={e=>setProfileForm({...profileForm,display_name:e.target.value})} maxLength="50"/></label><label>Biographie<textarea rows="3" maxLength="240" value={profileForm.bio} onChange={e=>setProfileForm({...profileForm,bio:e.target.value})}/></label><label className="check"><input type="checkbox" checked={profileForm.is_public} onChange={e=>setProfileForm({...profileForm,is_public:e.target.checked})}/> Profil public</label><button className="primary">Enregistrer</button></form><p className="muted tiny">E-mail privé : {session.user.email}</p></>}
    </div>
    <aside className="panel"><p className="eyebrow">COMPTE ET CONFIDENTIALITÉ</p><h2>État du compte</h2><div className="metric"><span>Connexion Supabase</span><b>{supabase?"Configurée":"À configurer"}</b></div><div className="metric"><span>Profil</span><b>{profile?"Créé":"En attente"}</b></div><div className="metric"><span>Rôle</span><b>{admin?"Administrateur":"Membre"}</b></div><p className="notice">Choisis un pseudonyme plutôt que ton nom complet. Ne publie pas d'informations personnelles dans ta biographie.</p></aside>
   </section>}
   {tab==="records"&&<section className="panel"><div className="section-head"><div><p className="eyebrow">MES PERFORMANCES</p><h2>Mes records</h2></div><div className="actions"><button className="secondary" onClick={exportData}>Exporter JSON</button><button className="secondary" onClick={()=>fileInput.current?.click()}>Importer JSON</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importData}/></div></div>
    {!session?<p className="muted">Connecte-toi pour enregistrer et gérer tes records.</p>:<>
     <form className="record-form" onSubmit={addManualSolve}><select value={recordForm.event_id} onChange={e=>setRecordForm({...recordForm,event_id:e.target.value})}>{activeEvents.map(ev=><option key={ev.id} value={ev.id}>{ev.name}</option>)}</select><select value={recordForm.stat_type} onChange={e=>setRecordForm({...recordForm,stat_type:e.target.value})}>{STAT_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select><input type="number" min="0.001" step="0.001" placeholder="Temps / valeur" value={recordForm.value} onChange={e=>setRecordForm({...recordForm,value:e.target.value})} required/><select value={recordForm.penalty} onChange={e=>setRecordForm({...recordForm,penalty:e.target.value})}><option value="none">Sans pénalité</option><option value="plus2">+2</option><option value="dnf">DNF</option></select><button className="primary">Ajouter</button></form>
     <div className="table-wrap"><table><thead><tr><th>Discipline</th><th>Statistique</th><th>Résultat</th><th>Pénalité</th><th>Date</th><th>Actions</th></tr></thead><tbody>{solves.map(s=><tr key={s.id}><td>{eventName(s.event_id)}</td><td>{s.stat_type}</td><td>{s.penalty==="dnf"?"DNF":formatTime(s.value,events.find(e=>e.id===s.event_id)?.unit||"s")}</td><td>{s.penalty==="plus2"?"+2":s.penalty==="dnf"?"DNF":"—"}</td><td>{new Date(s.created_at).toLocaleDateString("fr-FR")}</td><td><button className="link" onClick={()=>setEditSolve({...s,value:String(s.value)})}>Modifier</button> <button className="link danger-text" onClick={()=>deleteSolve(s.id)}>Supprimer</button></td></tr>)}</tbody></table></div>
    </>}
   </section>}
   {tab==="rankings"&&<section className="panel"><p className="eyebrow">COMMUNAUTÉ</p><h2>Classements publics</h2><div className="record-form"><select value={rankEvent} onChange={e=>setRankEvent(e.target.value)}>{activeEvents.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><select value={rankStat} onChange={e=>setRankStat(e.target.value)}>{STAT_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select><button className="primary" onClick={loadRankings}>Afficher</button></div><div className="table-wrap"><table><thead><tr><th>Rang</th><th>Cuber</th><th>Résultat</th><th>Date</th></tr></thead><tbody>{rankings.map((r,i)=><tr key={r.id}><td>#{i+1}</td><td><button className="link" onClick={()=>loadProfileByName(r.profiles.username)}>{r.profiles.display_name||r.profiles.username}</button></td><td>{r.penalty==="dnf"?"DNF":formatTime(r.value)}</td><td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div><p className="notice">Classement fondé sur les records de type sélectionné. Les moyennes avancées devront être recalculées à partir des résolutions brutes dans une future étape.</p></section>}
   {tab==="profileSearch"&&<section className="panel"><p className="eyebrow">DÉCOUVRIR</p><h2>Consulter un profil public</h2><form className="record-form" onSubmit={e=>{e.preventDefault();loadProfileByName(profileSearch);}}><input placeholder="Pseudonyme exact" value={profileSearch} onChange={e=>setProfileSearch(e.target.value)} required/><button className="primary">Rechercher</button></form><p className="muted">Les profils privés ne sont pas consultables.</p></section>}
   {tab==="publicProfile"&&publicProfile&&<section className="panel"><p className="eyebrow">PROFIL PUBLIC</p><h2>{publicProfile.display_name||publicProfile.username}</h2><p className="muted">@{publicProfile.username} · {publicProfile.bio}</p><h3>Performances enregistrées</h3><div className="table-wrap"><table><thead><tr><th>Discipline</th><th>Statistique</th><th>Résultat</th><th>Date</th></tr></thead><tbody>{publicSolves.map(s=><tr key={s.id}><td>{eventName(s.event_id)}</td><td>{s.stat_type}</td><td>{s.penalty==="dnf"?"DNF":formatTime(s.value)}</td><td>{new Date(s.created_at).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div></section>}
   {tab==="admin"&&<section className="panel"><p className="eyebrow">CONTRÔLE DU SITE</p><h2>Administration</h2>{!admin?<p className="muted">Accès réservé au propriétaire administrateur. Connecte-toi avec le compte auquel le rôle a été attribué dans Supabase.</p>:<>
    <div className="admin-section"><h3>Disciplines</h3><form className="record-form" onSubmit={addEvent}><input placeholder="Identifiant unique (ex. fmcube)" value={eventForm.id} onChange={e=>setEventForm({...eventForm,id:e.target.value})}/><input placeholder="Nom de la discipline" value={eventForm.name} onChange={e=>setEventForm({...eventForm,name:e.target.value})}/><button className="primary">Ajouter</button></form>{events.map(ev=><div className="admin-row" key={ev.id}><span><b>{ev.name}</b><small>{ev.id} · {ev.is_official?"WCA":"Personnalisée"}</small></span><button className="secondary" onClick={()=>{const name=prompt("Nouveau nom",ev.name);if(name?.trim())updateEvent(ev,{name:name.trim()});}}>Renommer</button><button className="secondary" onClick={()=>updateEvent(ev,{is_active:!ev.is_active})}>{ev.is_active?"Désactiver":"Activer"}</button><button className="danger" disabled={ev.is_official} onClick={()=>deleteEvent(ev)}>Supprimer</button></div>)}</div>
    <div className="admin-section"><h3>Statistiques</h3><form className="record-form" onSubmit={addStat}><select value={statForm.event_id} onChange={e=>setStatForm({...statForm,event_id:e.target.value})}>{events.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><input placeholder="Code statistique" value={statForm.stat_type} onChange={e=>setStatForm({...statForm,stat_type:slugify(e.target.value)})}/><input placeholder="Nom" value={statForm.label} onChange={e=>setStatForm({...statForm,label:e.target.value})}/><input placeholder="Unité" value={statForm.unit} onChange={e=>setStatForm({...statForm,unit:e.target.value})}/><button className="primary">Ajouter</button></form>{stats.map(s=><div className="admin-row" key={s.id}><span><b>{s.label}</b><small>{s.event_id} · {s.stat_type} · {s.unit}</small></span><button className="secondary" onClick={()=>updateStat(s,{visible_on_profile:!s.visible_on_profile})}>{s.visible_on_profile?"Masquer profil":"Afficher profil"}</button><button className="secondary" onClick={()=>updateStat(s,{included_in_rankings:!s.included_in_rankings})}>{s.included_in_rankings?"Retirer classement":"Inclure classement"}</button><button className="danger" onClick={()=>deleteStat(s)}>Supprimer</button></div>)}</div>
    <div className="admin-section"><h3>Niveaux personnalisés</h3><form className="record-form" onSubmit={addLevel}><select value={levelForm.event_id} onChange={e=>setLevelForm({...levelForm,event_id:e.target.value})}>{events.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><input placeholder="Type (ao5)" value={levelForm.stat_type} onChange={e=>setLevelForm({...levelForm,stat_type:e.target.value})}/><input placeholder="Nom (Sub-20)" value={levelForm.level_name} onChange={e=>setLevelForm({...levelForm,level_name:e.target.value})}/><input type="number" step="0.001" placeholder="Seuil max" value={levelForm.max_value} onChange={e=>setLevelForm({...levelForm,max_value:e.target.value})}/><button className="primary">Ajouter</button></form>{thresholds.map(l=><div className="admin-row" key={l.id}><span><b>{l.level_name}</b><small>{l.event_id} · {l.stat_type} · ≤ {l.max_value}</small></span><button className="danger" onClick={()=>deleteLevel(l)}>Supprimer</button></div>)}</div>
   </>}</section>}
   {editSolve&&<div className="modal-backdrop"><form className="panel modal" onSubmit={saveEditedSolve}><h2>Modifier un record</h2><label>Discipline<select value={editSolve.event_id} onChange={e=>setEditSolve({...editSolve,event_id:e.target.value})}>{activeEvents.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label><label>Statistique<select value={editSolve.stat_type} onChange={e=>setEditSolve({...editSolve,stat_type:e.target.value})}>{STAT_TYPES.map(s=><option value={s} key={s}>{s}</option>)}</select></label><label>Valeur<input type="number" min="0.001" step="0.001" value={editSolve.value} onChange={e=>setEditSolve({...editSolve,value:e.target.value})}/></label><label>Pénalité<select value={editSolve.penalty} onChange={e=>setEditSolve({...editSolve,penalty:e.target.value})}><option value="none">Aucune</option><option value="plus2">+2</option><option value="dnf">DNF</option></select></label><label>Mélange<textarea value={editSolve.scramble||""} onChange={e=>setEditSolve({...editSolve,scramble:e.target.value})}/></label><div className="actions"><button type="button" className="secondary" onClick={()=>setEditSolve(null)}>Annuler</button><button className="primary">Enregistrer</button></div></form></div>}
   {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  </main>
  <footer><b>CubeStats</b><span>Projet indépendant · Non affilié à la World Cube Association</span><button className="link" onClick={()=>setTheme(theme==="dark"?"light":"dark")}>Thème : {theme==="dark"?"sombre":"clair"}</button></footer>
 </div>;
}
