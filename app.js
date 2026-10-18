(() => {
  "use strict";

  const AGREEMENT_VERSION = "2026-10-18-v1";
  const DB_NAME = "a1-drain-field";
  const DB_VERSION = 1;
  const JOB_STORE = "jobs";
  const FILE_STORE = "files";
  let sb = null, user = null, currentJob = null, signaturePad = null;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uuid = () => crypto.randomUUID();

  function notice(message, error = false) {
    const el = $("appNotice");
    el.textContent = message || "";
    el.classList.toggle("hidden", !message);
    el.classList.toggle("error", error);
  }
  function authNotice(message, error = false) {
    const el = $("authNotice");
    el.textContent = message || "";
    el.classList.toggle("hidden", !message);
    el.classList.toggle("error", error);
  }
  function setView(view) {
    $("listView").classList.toggle("hidden", view !== "list");
    $("jobView").classList.toggle("hidden", view !== "job");
    window.scrollTo(0,0);
  }
  function setConnection() {
    notice(navigator.onLine ? "Online — cloud sync available." : "Offline — jobs are saved on this device until the connection returns.");
  }

  function db() {
    return new Promise((resolve,reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(JOB_STORE)) {
          const s = d.createObjectStore(JOB_STORE, {keyPath:"localId"});
          s.createIndex("userId","userId"); s.createIndex("remoteId","remoteId"); s.createIndex("updatedAt","updatedAt");
        }
        if (!d.objectStoreNames.contains(FILE_STORE)) d.createObjectStore(FILE_STORE,{keyPath:"id"});
      };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async function idb(store, mode, action) {
    const d = await db();
    return new Promise((resolve,reject) => {
      const tx = d.transaction(store,mode), os = tx.objectStore(store), result = action(os);
      if (result && "onsuccess" in result) result.onsuccess = () => resolve(result.result);
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const put = (s,v) => idb(s,"readwrite",os => os.put(v));
  const all = s => idb(s,"readonly",os => os.getAll());
  const get = (s,k) => idb(s,"readonly",os => os.get(k));
  const del = (s,k) => idb(s,"readwrite",os => os.delete(k));

  async function localJobs() { return (await all(JOB_STORE)).filter(j => j.userId === user.id); }
  async function localFiles(localId) { return (await all(FILE_STORE)).filter(f => f.localJobId === localId); }

  function readJobForm() {
    const job = {
      cust_name: $("custName").value.trim(), cust_phone: $("custPhone").value.trim(),
      service_addr: $("serviceAddr").value.trim(), invoice_num: $("invoiceNum").value.trim(),
      signer_name: $("signerName").value.trim(), work_desc: $("workDesc").value.trim(), exist_notes: $("existNotes").value.trim()
    };
    if (!job.cust_name || !job.service_addr) throw new Error("Customer name and service address are required.");
    if (job.cust_name.length > 160 || job.cust_phone.length > 40 || job.service_addr.length > 300 || job.invoice_num.length > 80 || job.signer_name.length > 160 || job.work_desc.length > 5000 || job.exist_notes.length > 5000) throw new Error("One or more fields are too long.");
    return job;
  }

  async function saveLocal(job) {
    job.userId = user.id;
    job.localId ||= uuid();
    job.updatedAt = new Date().toISOString();
    await put(JOB_STORE,job); return job;
  }

  function clearForm() {
    ["custName","custPhone","serviceAddr","invoiceNum","signerName","workDesc","existNotes","compNotes"].forEach(id => $(id).value = "");
    $("authorization").checked = false; $("invoicePhoto").value = ""; $("jobPhotos").value = ""; $("photoPreview").innerHTML = "";
    signaturePad?.clear(); currentJob = null;
  }

  function fillForm(job) {
    $("custName").value = job.cust_name || ""; $("custPhone").value = job.cust_phone || "";
    $("serviceAddr").value = job.service_addr || ""; $("invoiceNum").value = job.invoice_num || "";
    $("signerName").value = job.signer_name || ""; $("workDesc").value = job.work_desc || ""; $("existNotes").value = job.exist_notes || "";
    $("compNotes").value = job.comp_notes || ""; $("authorization").checked = !!job.is_signed;
  }

  function initSignature(dataUrl) {
    const canvas = $("signatureCanvas"), ratio = Math.max(devicePixelRatio || 1,1);
    canvas.width = Math.max(300,canvas.clientWidth) * ratio; canvas.height = 220 * ratio;
    canvas.style.height = "220px";
    const ctx = canvas.getContext("2d"); ctx.scale(ratio,ratio);
    signaturePad = new SignaturePad(canvas,{backgroundColor:"rgb(255,255,255)",penColor:"rgb(20,20,20)"});
    if (dataUrl) signaturePad.fromDataURL(dataUrl);
  }

  async function compress(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Please select an image.");
    const bitmap = await createImageBitmap(file), max = 1800;
    const scale = Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const c = document.createElement("canvas"); c.width = Math.max(1,Math.round(bitmap.width*scale)); c.height = Math.max(1,Math.round(bitmap.height*scale));
    c.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,c.width,c.height); bitmap.close();
    let q=.82, blob=await new Promise(r=>c.toBlob(r,"image/jpeg",q));
    while(blob && blob.size>900*1024 && q>.5){q-=.07; blob=await new Promise(r=>c.toBlob(r,"image/jpeg",q));}
    if(!blob) throw new Error("Could not process the photo."); return blob;
  }

  async function addFile(blob, localJobId, kind) {
    const id=uuid(); await put(FILE_STORE,{id,blob,localJobId,kind,remotePath:null}); return id;
  }

  function payload(job) {
    return {user_id:user.id,cust_name:job.cust_name,cust_phone:job.cust_phone || "",service_addr:job.service_addr,invoice_num:job.invoice_num || "",work_desc:job.work_desc || "",exist_notes:job.exist_notes || null,signer_name:job.signer_name || null,signature_data:job.signature_data || null,sign_time:job.sign_time || null,timezone:job.timezone || null,agreement_version:job.agreement_version || AGREEMENT_VERSION,is_signed:!!job.is_signed,invoice_photo:job.invoice_photo || null,job_photos:job.job_photos || [],comp_notes:job.comp_notes || null};
  }

  async function uploadFile(remoteId,f) {
    const path=`${user.id}/${remoteId}/${f.kind}-${f.id}.jpg`;
    const {error}=await sb.storage.from("job-photos").upload(path,f.blob,{contentType:"image/jpeg",upsert:false});
    if(error) throw error; f.remotePath=path; await put(FILE_STORE,f); return path;
  }

  async function syncJob(job) {
    if(!navigator.onLine) return job;
    let remote;
    if(job.remoteId){ const r=await sb.from("jobs").update(payload(job)).eq("id",job.remoteId).select().single(); if(r.error) throw r.error; remote=r.data; }
    else { const r=await sb.from("jobs").insert(payload(job)).select().single(); if(r.error) throw r.error; remote=r.data; }
    let invoice=remote.invoice_photo, photos=[...(remote.job_photos||[])];
    for(const f of await localFiles(job.localId)){
      if(f.remotePath) continue;
      const path=await uploadFile(remote.id,f); if(f.kind==="invoice") invoice=path; else photos.push(path);
    }
    if(invoice!==remote.invoice_photo || photos.length!==(remote.job_photos||[]).length){ const r=await sb.from("jobs").update({invoice_photo:invoice,job_photos:photos}).eq("id",remote.id).select().single(); if(r.error) throw r.error; remote=r.data; }
    job={...job,...remote,remoteId:remote.id,syncState:"synced",updatedAt:remote.updated_at||new Date().toISOString()}; await put(JOB_STORE,job); return job;
  }

  async function syncPending() {
    if(!navigator.onLine || !user) return;
    const jobs=await localJobs();
    for(const job of jobs) if(job.syncState!=="synced") { try{await syncJob(job);}catch(e){console.error(e);} }
    const r=await sb.from("jobs").select("*").order("updated_at",{ascending:false});
    if(!r.error) for(const remote of r.data||[]){
      const local=jobs.find(j=>j.remoteId===remote.id);
      if(!local) await put(JOB_STORE,{...remote,localId:uuid(),userId:user.id,syncState:"synced",updatedAt:remote.updated_at});
    }
    await renderJobs();
  }

  async function renderJobs() {
    const q=$("searchInput").value.trim().toLowerCase(), jobs=(await localJobs()).filter(j=>!q || [j.cust_name,j.cust_phone,j.service_addr,j.invoice_num].join(" ").toLowerCase().includes(q)).sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0));
    $("jobList").innerHTML=jobs.length?jobs.map(j=>`<article class="job-row" data-id="${esc(j.localId)}"><div><div class="job-title">${esc(j.cust_name)}</div><div class="small muted">${esc(j.service_addr)} · ${esc(j.invoice_num||"No invoice #")}</div><div class="small">${j.syncState==="synced"?"Cloud synced":"Saved on this device"}</div></div><span class="status ${j.is_signed?"signed":"pending"}">${j.is_signed?"Signed":"Draft"}</span></article>`).join(""):"<p class='muted'>No job records yet.</p>";
    $("jobList").querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>openJob(el.dataset.id));
  }

  async function openJob(localId) {
    const job=await get(JOB_STORE,localId); if(!job||job.userId!==user.id)return;
    currentJob=job; fillForm(job); $("jobHeading").textContent="Job Record"; $("deleteBtn").classList.remove("hidden");
    $("photoPreview").innerHTML="";
    for(const f of await localFiles(localId)){const img=document.createElement("img");img.src=URL.createObjectURL(f.blob);img.alt=f.kind==="invoice"?"Invoice photo":"Job photo";$("photoPreview").appendChild(img);}
    initSignature(job.signature_data||null); setView("job");
  }

  async function newJob(){clearForm();$("jobHeading").textContent="New Job";$("deleteBtn").classList.add("hidden");initSignature();setView("job");}

  async function saveFinalize(e){
    e.preventDefault();
    try{
      let data=readJobForm();
      if(!$("authorization").checked) throw new Error("Customer authorization must be checked before saving.");
      if(!signaturePad || signaturePad.isEmpty()) throw new Error("Customer signature is required.");
      if(!data.signer_name) throw new Error("Authorized signer name is required.");
      if(!currentJob) currentJob={localId:uuid(),syncState:"pending"};
      currentJob=await saveLocal({...currentJob,...data,is_signed:true,signature_data:signaturePad.toDataURL("image/png"),sign_time:currentJob.sign_time||new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",agreement_version:AGREEMENT_VERSION,comp_notes:$("compNotes").value.trim(),syncState:"pending"});
      const invoice=$("invoicePhoto").files[0], photos=[...$("jobPhotos").files];
      if(invoice) await addFile(await compress(invoice),currentJob.localId,"invoice");
      for(const f of photos) await addFile(await compress(f),currentJob.localId,"job");
      if(navigator.onLine){try{currentJob=await syncJob(currentJob);notice("Job saved to cloud.");}catch(err){console.error(err);notice("Job saved on this device. Cloud sync will retry.");}}
      else notice("Job saved on this device. It will sync when you are back online.");
      await renderJobs(); setView("list"); currentJob=null;
    }catch(err){notice(err.message||"Could not save the job.",true);}
  }

  async function deleteJob(){
    if(!currentJob||!confirm("Delete this job record? This cannot be undone."))return;
    if(currentJob.remoteId&&navigator.onLine){const r=await sb.from("jobs").delete().eq("id",currentJob.remoteId);if(r.error)throw r.error;const paths=[currentJob.invoice_photo,...(currentJob.job_photos||[])].filter(Boolean);if(paths.length)await sb.storage.from("job-photos").remove(paths);}
    for(const f of await localFiles(currentJob.localId))await del(FILE_STORE,f.id);await del(JOB_STORE,currentJob.localId);currentJob=null;await renderJobs();setView("list");
  }

  async function pdf(){
    if(!currentJob||!window.jspdf?.jsPDF)throw new Error("PDF library is unavailable. Connect once and reload.");
    const {jsPDF}=window.jspdf,doc=new jsPDF();let y=18;
    doc.setFontSize(16);doc.text("A-1 Drain Cleaning",15,y);y+=7;doc.setFontSize(10);doc.text("641-530-2728 · 206 29th St SW · Mason City, Iowa 50401",15,y);y+=10;doc.setFontSize(11);
    const row=(k,v)=>{doc.setFont("helvetica","bold");doc.text(k,15,y);doc.setFont("helvetica","normal");const lines=doc.splitTextToSize(String(v||"—"),170);doc.text(lines,15,y+6);y+=8+lines.length*5;if(y>275){doc.addPage();y=18;}};
    row("Customer:",currentJob.cust_name);row("Phone:",currentJob.cust_phone);row("Service address:",currentJob.service_addr);row("Invoice / job:",currentJob.invoice_num);row("Work:",currentJob.work_desc);row("Existing conditions:",currentJob.exist_notes);row("Authorized signer:",currentJob.signer_name);row("Signed:",currentJob.sign_time?new Date(currentJob.sign_time).toLocaleString():"Not signed");row("Completion notes:",currentJob.comp_notes);row("Agreement:",currentJob.agreement_version);doc.save(`A-1-${currentJob.invoice_num||"job"}.pdf`);
  }

  async function boot(){
    setConnection();
    if(!window.A1_CONFIG?.SUPABASE_URL||!window.A1_CONFIG?.SUPABASE_ANON_KEY||window.A1_CONFIG.SUPABASE_URL.includes("YOUR_")||window.A1_CONFIG.SUPABASE_ANON_KEY.includes("YOUR_")){authNotice("Supabase is not configured yet. Add the public Project URL and anon key to config.js.",true);return;}
    try{sb=window.supabase.createClient(window.A1_CONFIG.SUPABASE_URL,window.A1_CONFIG.SUPABASE_ANON_KEY);sb.auth.onAuthStateChange(async(_,session)=>{user=session?.user||null;$("authView").classList.toggle("hidden",!!user);$("appView").classList.toggle("hidden",!user);$("logoutBtn").classList.toggle("hidden",!user);if(user){await renderJobs();if(navigator.onLine)await syncPending();}});const {data}=await sb.auth.getSession();if(data.session){user=data.session.user;$("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");await renderJobs();if(navigator.onLine)await syncPending();}}catch(e){console.error(e);authNotice("The app could not initialize. Check config.js and your connection.",true);}
  }

  $("authForm").addEventListener("submit",async e=>{e.preventDefault();authNotice("");try{const email=$("authEmail").value.trim(),password=$("authPassword").value;if(!email||password.length<8)throw new Error("Enter a valid email and a password of at least 8 characters.");const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;}catch(e){authNotice(e.message||"Sign in failed.",true);}});
  $("createAccountBtn").onclick=async()=>{authNotice("");try{const email=$("authEmail").value.trim(),password=$("authPassword").value;if(!email||password.length<8)throw new Error("Enter a valid email and a password of at least 8 characters.");const {data,error}=await sb.auth.signUp({email,password});if(error)throw error;authNotice(data.session?"Account created.":"Account created. Check your email if verification is enabled.");}catch(e){authNotice(e.message||"Account creation failed.",true);}};
  $("logoutBtn").onclick=async()=>{await sb.auth.signOut();};
  $("newJobBtn").onclick=newJob;$("backBtn").onclick=async()=>{await renderJobs();setView("list");};$("deleteBtn").onclick=async()=>{try{await deleteJob();}catch(e){notice(e.message||"Delete failed.",true);}};$("jobForm").addEventListener("submit",saveFinalize);$("clearSignature").onclick=()=>signaturePad?.clear();$("pdfBtn").onclick=async()=>{try{await pdf();}catch(e){notice(e.message||"PDF creation failed.",true);}};$("searchInput").oninput=renderJobs;
  window.addEventListener("online",async()=>{setConnection();if(user)await syncPending();});window.addEventListener("offline",setConnection);
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error);
  boot();
})();
