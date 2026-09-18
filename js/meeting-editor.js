import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase.js";

if (!document.querySelector('link[data-meeting-editor]')) {
  const link=document.createElement("link"); link.rel="stylesheet"; link.href="./meeting-editor.css?v=20260918-1"; link.dataset.meetingEditor="true"; document.head.append(link);
}

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const valueOf = value => value?.toDate ? value.toDate() : new Date(value || Date.now());
const localDate = value => { const d=valueOf(value); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
const founder = profile => profile?.root === true && profile?.systemRole === "founder_director";

function dialogHtml(meeting, directory, attendance, agenda) {
  const invited = new Set(meeting.invitedDirectorUids || []);
  return `<dialog class="meeting-editor"><form method="dialog" class="meeting-editor-shell">
    <header><div><span>MEETING SETUP</span><h2>Edit ${esc(meeting.meetingNumber || "meeting")}</h2><p>Update meeting details, invited directors, and queued agenda items before check-in opens.</p></div><button value="cancel" class="meeting-editor-close" aria-label="Close">×</button></header>
    <div class="meeting-editor-body">
      <section><h3>Meeting details</h3><div class="meeting-editor-grid">
        <label>Title<input name="title" maxlength="180" required value="${esc(meeting.title)}"></label>
        <label>Date and time<input name="scheduledFor" type="datetime-local" required value="${localDate(meeting.scheduledFor || meeting.scheduledStart)}"></label>
        <label>Meeting type<select name="meetingType">${["regular","special","emergency","annual"].map(v=>`<option value="${v}" ${meeting.meetingType===v||meeting.type===v?"selected":""}>${v[0].toUpperCase()+v.slice(1)}</option>`).join("")}</select></label>
        <label>Format<select name="locationMode">${[["in_person","In person"],["virtual","Virtual"],["hybrid","Hybrid"]].map(([v,l])=>`<option value="${v}" ${(meeting.locationMode||meeting.mode)===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <label class="wide">Location or meeting link<input name="locationLabel" maxlength="300" value="${esc(meeting.locationLabel || meeting.location)}"></label>
        <label>Quorum required<input name="quorumRequired" type="number" min="1" max="100" required value="${Number(meeting.quorumRequired)||1}"></label>
        <label class="wide">Notes<textarea name="notes" maxlength="2000" rows="3">${esc(meeting.notes)}</textarea></label>
      </div></section>
      <section><div class="meeting-editor-title"><h3>Invited directors</h3><span>${attendance.length} currently invited</span></div><div class="meeting-editor-roster">${directory.filter(d=>["interim","confirmed","leave_of_absence"].includes(d.boardStatus)).map(d=>`<label><input type="checkbox" name="director" value="${esc(d.uid)}" ${invited.has(d.uid)?"checked":""}><span><strong>${esc(d.fullName||d.displayName||"Director")}</strong><small>${esc(d.directorNumber||"")} · ${esc(d.boardRole||"Director")}${d.votingStatus==="ineligible"?" · Non-voting":""}</small></span></label>`).join("")}</div></section>
      <section><div class="meeting-editor-title"><h3>Agenda items</h3><button type="button" data-add-agenda>+ Add item</button></div><div data-agenda-list>${agenda.map((a,i)=>agendaRow(a,i)).join("")}</div></section>
      <p class="meeting-editor-message" role="status"></p>
    </div><footer><button value="cancel" class="secondary-button">Cancel</button><button type="button" data-save-meeting class="meeting-primary-button">Save changes</button></footer>
  </form></dialog>`;
}

function agendaRow(item={}, index=0) {
  return `<div class="meeting-editor-agenda" data-agenda-id="${esc(item.id||"")}"><span class="drag-number">${index+1}</span><div><input data-agenda-title maxlength="180" required placeholder="Agenda item title" value="${esc(item.title)}"><textarea data-agenda-description maxlength="1200" rows="2" placeholder="Description (optional)">${esc(item.description)}</textarea></div><select data-agenda-type>${["business","report","motion","resolution","election","other"].map(v=>`<option value="${v}" ${item.itemType===v?"selected":""}>${v}</option>`).join("")}</select><button type="button" data-remove-agenda aria-label="Remove item">×</button></div>`;
}

export async function openMeetingEditor({ meeting, profile, directory }) {
  if (!founder(profile)) throw new Error("Only the Founder can edit meeting setup.");
  if (meeting.status !== "scheduled" || meeting.deleted) throw new Error("Meeting setup locks when check-in opens.");
  const [attendanceSnap, agendaSnap] = await Promise.all([
    getDocs(query(collection(db,"meetingAttendance"),where("meetingId","==",meeting.id))),
    getDocs(query(collection(db,"agendaItems"),where("meetingId","==",meeting.id)))
  ]);
  const attendance=attendanceSnap.docs.map(d=>({id:d.id,...d.data()}));
  const agenda=agendaSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.status==="queued").sort((a,b)=>(a.order||0)-(b.order||0));
  const host=document.createElement("div"); host.innerHTML=dialogHtml(meeting,directory,attendance,agenda); const dialog=host.firstElementChild; document.body.append(dialog);
  const list=dialog.querySelector("[data-agenda-list]");
  dialog.addEventListener("click",e=>{ if(e.target.closest("[data-add-agenda]")){list.insertAdjacentHTML("beforeend",agendaRow({},list.children.length));} const remove=e.target.closest("[data-remove-agenda]"); if(remove) remove.closest(".meeting-editor-agenda").remove(); });
  dialog.addEventListener("close",()=>dialog.remove(),{once:true}); dialog.showModal();
  dialog.querySelector("[data-save-meeting]").addEventListener("click",async()=>{
    const button=dialog.querySelector("[data-save-meeting]"), message=dialog.querySelector(".meeting-editor-message"), form=new FormData(dialog.querySelector("form"));
    const selected=[...dialog.querySelectorAll('[name="director"]:checked')].map(x=>x.value); const byUid=new Map(directory.map(d=>[d.uid,d])); const eligible=selected.filter(uid=>byUid.get(uid)?.votingStatus!=="ineligible");
    const quorum=Number(form.get("quorumRequired")); if(!selected.length||!Number.isInteger(quorum)||quorum<1||quorum>eligible.length){message.textContent="Invite at least one voting director and choose a valid quorum.";return;}
    const rows=[...list.querySelectorAll(".meeting-editor-agenda")].map((row,index)=>({id:row.dataset.agendaId,title:row.querySelector("[data-agenda-title]").value.trim(),description:row.querySelector("[data-agenda-description]").value.trim(),itemType:row.querySelector("[data-agenda-type]").value,order:index+1})); if(rows.some(r=>!r.title)){message.textContent="Every agenda item needs a title.";return;}
    button.disabled=true; message.textContent="Saving meeting changes…";
    try { await saveSetup({meeting,profile,directory,attendance,agenda,selected,eligible,quorum,form,rows}); dialog.close(); }
    catch(error){console.error(error); message.textContent=error?.code==="permission-denied"?"Firebase rules must be published before this editor can save.":(error.message||"Changes could not be saved."); button.disabled=false;}
  });
}

async function saveSetup({meeting,profile,directory,attendance,agenda,selected,eligible,quorum,form,rows}) {
  const meetingRef=doc(db,"meetings",meeting.id), selectedSet=new Set(selected), oldSet=new Set(attendance.map(a=>a.directorUid));
  await runTransaction(db,async tx=>{
    const live=await tx.get(meetingRef); if(!live.exists()||live.data().status!=="scheduled"||live.data().deleted) throw new Error("Meeting setup is now locked. Refresh and try again.");
    tx.update(meetingRef,{title:String(form.get("title")).trim(),meetingType:form.get("meetingType"),scheduledFor:form.get("scheduledFor"),locationMode:form.get("locationMode"),locationLabel:String(form.get("locationLabel")).trim()||null,notes:String(form.get("notes")).trim()||null,invitedDirectorUids:selected,eligibleVotingDirectorUids:eligible,quorumRequired:quorum,updatedAt:serverTimestamp(),updatedBy:profile.uid});
    for(const uid of selected.filter(x=>!oldSet.has(x))){const d=directory.find(x=>x.uid===uid);tx.set(doc(db,"meetingAttendance",`${meeting.id}_${uid}`),{meetingId:meeting.id,directorUid:uid,directorNumber:d.directorNumber||null,directorName:d.fullName||d.displayName||"Director",boardRole:d.boardRole||"Director",officerRole:d.officerRole||null,votingEligible:d.votingStatus!=="ineligible",invited:true,presenceStatus:"invited",checkedInAt:null,departedAt:null,returnedAt:null,excusedAt:null,absentAt:null,lastPresenceChangeAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:profile.uid});}
    for(const a of attendance.filter(x=>!selectedSet.has(x.directorUid))) tx.delete(doc(db,"meetingAttendance",a.id));
    const kept=new Set(rows.filter(r=>r.id).map(r=>r.id)); for(const a of agenda.filter(x=>!kept.has(x.id))) tx.delete(doc(db,"agendaItems",a.id));
    for(const r of rows){const ref=r.id?doc(db,"agendaItems",r.id):doc(collection(db,"agendaItems")); const data={meetingId:meeting.id,title:r.title,description:r.description||null,itemType:r.itemType,order:r.order,agendaNumber:`AGENDA-${String(r.order).padStart(2,"0")}`,status:"queued",documentId:null,updatedAt:serverTimestamp(),updatedBy:profile.uid}; if(r.id) tx.update(ref,data); else tx.set(ref,{...data,createdAt:serverTimestamp(),createdBy:profile.uid});}
    tx.set(doc(collection(db,"auditEvents")),{action:"meeting_setup_edited",actorUid:profile.uid,meetingId:meeting.id,createdAt:serverTimestamp()});
  });
}
