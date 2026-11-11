import { useState } from "react";
import type { FollowUpEntry, FollowUpPriority, FollowUpStatus } from "./lib/follow-ups";

type Property = { id:string; title:string; module:string; value:string; status?:string };
type Contact = { id:string; name:string; phone?:string; role?:string };
type WhatsAppGroup = { id:string; jid:string; name:string; size?:number };
export type FollowUpDraft = { propertyId:string; entry:FollowUpEntry };
type Props = {
  properties:Property[];
  contacts:Contact[];
  groups?:WhatsAppGroup[];
  defaultPropertyId?:string;
  defaultContactId?:string;
  initial?:FollowUpEntry|null;
  onSave:(draft:FollowUpDraft)=>void;
  onCancel:()=>void;
};

export default function FollowUpForm({properties,contacts,groups=[],defaultPropertyId,defaultContactId,initial,onSave,onCancel}:Props) {
  const [form,setForm]=useState(()=>{
    const property=properties.find(item=>item.id===defaultPropertyId);
    return {
      propertyId:defaultPropertyId||"",
      contactIds:initial?.contactIds ?? (defaultContactId ? [defaultContactId] : []),
      whatsAppGroupIds:initial?.whatsAppGroupIds ?? [],
      description:initial?.description ?? "",
      amount:initial?.amount ?? property?.value ?? "",
      date:initial?.date ?? new Date().toISOString().slice(0,10),
      time:initial?.time ?? "10:00",
      priority:initial?.priority ?? "Normal" as FollowUpPriority,
      status:initial?.status ?? "Open" as FollowUpStatus,
      notes:initial?.notes ?? "",
      nextAction:initial?.nextAction ?? ""
    };
  });
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const selectedProperty=properties.find(item=>item.id===form.propertyId);
  const toggleContact=(id:string)=>{
    setForm(previous=>({...previous,contactIds:previous.contactIds.includes(id)
      ? previous.contactIds.filter(value=>value!==id)
      : [...previous.contactIds,id]}));
  };
  const toggleGroup=(id:string)=>setForm(previous=>({...previous,whatsAppGroupIds:previous.whatsAppGroupIds.includes(id)
    ? previous.whatsAppGroupIds.filter(value=>value!==id) : [...previous.whatsAppGroupIds,id]}));
  return <form className="form-card ax-followup-form" onSubmit={event=>{
    event.preventDefault();
    if(!form.propertyId || !form.description.trim() || !form.date) return;
    onSave({
      propertyId:form.propertyId,
      entry:{
        id:initial?.id || (typeof crypto!=="undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "fu-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)),
        contactIds:form.contactIds,
        whatsAppGroupIds:form.whatsAppGroupIds,
        description:form.description.trim(),
        amount:form.amount,
        date:form.date,
        time:form.time,
        priority:form.priority,
        status:form.status,
        notes:form.notes.trim(),
        nextAction:form.nextAction.trim(),
        assignedAt:initial?.assignedAt || new Date().toISOString()
      }
    });
  }}>
    <label>Related module record *<select required value={form.propertyId} onChange={event=>{
      const id=event.target.value;
      const item=properties.find(property=>property.id===id);
      setForm(previous=>({...previous,propertyId:id,amount:previous.amount || item?.value || ""}));
    }}><option value="">Choose source record</option>{properties.map(item=><option key={item.id} value={item.id}>{item.module} · {item.title}</option>)}</select></label>
    {selectedProperty && <div className="ax-followup-source-context"><strong>{selectedProperty.module}</strong><span>{selectedProperty.title}</span><small>Record value / amount: ₹{Number(selectedProperty.value||0).toLocaleString("en-IN",{maximumFractionDigits:2})}</small></div>}
    <label>Follow-up description *<input required value={form.description} onChange={event=>update("description",event.target.value)} placeholder="What specifically must be followed up?"/></label>
    <div className="form-two"><label>Follow-up date *<input required type="date" value={form.date} onChange={event=>update("date",event.target.value)}/></label><label>Follow-up time<input type="time" value={form.time} onChange={event=>update("time",event.target.value)}/></label></div>
    <div className="form-two"><label>Priority<select value={form.priority} onChange={event=>update("priority",event.target.value)}>{(["Urgent","High","Normal","Low"] as FollowUpPriority[]).map(value=><option key={value}>{value}</option>)}</select></label><label>Status<select value={form.status} onChange={event=>update("status",event.target.value)}>{(["Open","In Progress","Completed","Cancelled"] as FollowUpStatus[]).map(value=><option key={value}>{value}</option>)}</select></label></div>
    <label>Follow-up amount (₹)<input inputMode="decimal" value={form.amount} onChange={event=>update("amount",event.target.value)} placeholder="Optional — defaults to linked record value"/></label>
    <fieldset className="ax-followup-contact-picker"><legend>Follow-up people</legend><p>Select one or more people responsible for this follow-up.</p><div className="ax-followup-group-actions"><button type="button" onClick={()=>setForm(previous=>({...previous,contactIds:Array.from(new Set([...previous.contactIds,...contacts.map(person=>person.id)]))}))}>Select all contacts</button><button type="button" onClick={()=>setForm(previous=>({...previous,contactIds:[]}))}>Clear contacts</button></div><div className="ax-followup-contact-options">{contacts.length ? contacts.map(person=><label key={person.id} className={form.contactIds.includes(person.id)?"selected":""}><input type="checkbox" checked={form.contactIds.includes(person.id)} onChange={()=>toggleContact(person.id)}/><span><strong>{person.name}</strong><small>{person.role || person.phone || "Contact"}</small></span></label>) : <small>No contacts saved yet. Add contacts first.</small>}</div></fieldset>
    <fieldset className="ax-followup-contact-picker"><legend>WhatsApp groups linked to this follow-up</legend><p>Select saved groups to associate with this action. This does not send a message.</p><div className="ax-followup-group-actions"><button type="button" onClick={()=>setForm(previous=>({...previous,whatsAppGroupIds:Array.from(new Set([...previous.whatsAppGroupIds,...groups.map(group=>group.id)]))}))}>Select all groups</button><button type="button" onClick={()=>setForm(previous=>({...previous,whatsAppGroupIds:[]}))}>Clear groups</button></div><div className="ax-followup-contact-options">{groups.length ? groups.map(group=><label key={group.id} className={form.whatsAppGroupIds.includes(group.id)?"selected":""}><input type="checkbox" checked={form.whatsAppGroupIds.includes(group.id)} onChange={()=>toggleGroup(group.id)}/><span><strong>{group.name}</strong><small>{group.size ? group.size+" members · " : ""}{group.jid}</small></span></label>) : <small>No saved WhatsApp groups are available. Sync groups from the WhatsApp Automation workspace first.</small>}</div></fieldset>
    <label>Next action<input value={form.nextAction} onChange={event=>update("nextAction",event.target.value)} placeholder="Specific next step after this contact"/></label>
    <label>Notes<textarea rows={3} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Call notes, pending documents, commitments and context"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial?"Save follow-up changes":"Save follow-up"}</button></div>
  </form>;
}
