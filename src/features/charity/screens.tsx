import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { Plus, ClipboardList, UsersRound, HeartHandshake, ArrowUpRight, LockKeyhole, Building2, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { snapshotQuery } from '@/api/queries';
import { attendanceRows } from '@/lib/attendance';
import type { Snapshot, Request } from '@/api/types';
import { Status, filledSpots, requestDate } from '@/components/shared/common';
import { Button } from '@/components/ui/button';
import { TaskTag } from '@/features/volunteer/screens';
import communityImage from '@/assets/community-volunteers.jpg';
export function PageHeading({title,description,children}:{title:string;description:string;children?:import('react').ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;}
export function Stat({label,value,foot,icon:Icon}:{label:string;value:number|string;foot:string;icon:typeof UsersRound}) {return <article className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon/></span></div><div className="stat-number">{value}</div><p className="stat-foot">{foot}</p></article>;}
export function RequestTable({data,requests,showPeople=true,highlightId}:{data:Snapshot;requests:Request[];showPeople?:boolean;highlightId?:string|undefined}) {return <div className="table-wrap"><table><thead><tr><th>Request</th><th>Date & time</th><th>Volunteers</th>{showPeople&&<th>Accepted by</th>}<th>Status</th></tr></thead><tbody>{requests.map(r=>{const when=requestDate(data,r);const count=filledSpots(data,r);const names=data.commitments.filter(c=>c.status==='accepted'&&r.occurrenceIds.includes(c.occurrenceId)).map(c=>data.volunteers.find(v=>v.id===c.volunteerId)?.name??'Volunteer');return <tr key={r.id} className={r.id===highlightId?'row-new':undefined}><td><div className="table-title">{r.title}</div><div className="table-sub">{r.taskType} · {r.location}</div></td><td><div className="table-title">{when.date}</div><div className="table-sub">{when.time}</div></td><td><div className="capacity"><span>{count} / {r.volunteersNeeded}</span><div className="capacity-track">{Array.from({length:r.volunteersNeeded},(_,i)=><span key={i} className={`capacity-segment ${i<count?'filled':''}`}/>)}</div></div></td>{showPeople&&<td>{names.length?names.map(n=><div key={n} className="table-person"><span className="avatar">{n.split(' ').map(x=>x[0]).join('')}</span><span className="table-sub">{n}</span></div>):<span className="table-sub">No volunteers yet</span>}</td>}<td><Status status={r.status}/></td></tr>;})}</tbody></table><div className="table-footer"><span>{requests.length} requests</span><span>Read-only overview</span></div></div>;}
export function DashboardScreen() {const {data}=useSuspenseQuery(snapshotQuery);const count=data.commitments.filter(c=>c.status==='accepted').length;const open=data.requests.filter(r=>r.status==='open');const waitingCount=attendanceRows(data).waiting.length;const needed=open.reduce((s,r)=>s+r.volunteersNeeded,0);return <><PageHeading title="Good morning, Fiona" description="Here’s what’s happening at Thistle Community Care."><Button asChild><Link to="/charity/create"><Plus/> Create request</Link></Button></PageHeading>{waitingCount > 0 && <Link to="/charity/attendance" className="attendance-callout"><ClipboardCheck/><span><strong>{waitingCount} {waitingCount===1?"volunteer":"volunteers"} to confirm.</strong> Let us know who came to last week’s sessions.</span><ArrowUpRight/></Link>}<div className="stats-grid"><Stat label="Open requests" value={open.length} foot="Opportunities to make a difference" icon={ClipboardList}/><Stat label="Volunteer commitments" value={count} foot="Good people ready to lend a hand" icon={UsersRound}/><Stat label="Spots still to fill" value={needed-count} foot="A little help goes a long way" icon={HeartHandshake}/></div><div className="desktop-section-heading"><h2>Your requests</h2><Button asChild variant="ghost" size="sm"><Link to="/charity/requests">View all requests <ArrowUpRight/></Link></Button></div><RequestTable data={data} requests={data.requests}/><div className="community-strip"><img src={communityImage} alt="Volunteers sorting fresh food together" width={1536} height={1024} loading="lazy"/><div><span className="eyebrow">Good happens together</span><h2>At the heart of your community.</h2><p>From food parcels to a friendly conversation, every helping hand makes Edinburgh a little brighter.</p></div></div></>;}
export function RequestsScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { created } = useSearch({ from: '/charity/requests' });
  const createdRequest = created ? data.requests.find((r) => r.id === created) : undefined;
  return (
    <>
      <PageHeading title="Your requests" description="Every opportunity, and the people bringing it to life."><Button asChild><Link to="/charity/create"><Plus/> Create request</Link></Button></PageHeading>
      {createdRequest && (
        <p className="created-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          {createdRequest.status === 'draft'
            ? <span><strong>“{createdRequest.title}”</strong> is saved as a draft. Volunteers can’t see it yet.</span>
            : <span><strong>“{createdRequest.title}”</strong> is live. Volunteers whose preferences fit will see it on their board.</span>}
        </p>
      )}
      <RequestTable data={data} requests={data.requests} highlightId={createdRequest?.id}/>
      <p className="readonly-note mt-5"><LockKeyhole/> Editing, sorting and request actions come in step 4.</p>
    </>
  );
}
export function CharityProfileScreen(){const {data}=useSuspenseQuery(snapshotQuery);const c=data.charity;return <><PageHeading title="Charity profile" description="The people and purpose behind your good work."/><div className="profile-desktop"><div className="profile-desktop-header"><span className="avatar avatar-large"><Building2 size={30}/></span><div><h2>{c.name}</h2><Status status={c.verification}/></div></div><div className="profile-columns"><section><h3>Organisation details</h3><div className="detail-row"><span>Registered number</span><span>{c.registrationNumber}</span></div><div className="detail-row"><span>Address</span><span>{c.address}<br/>{c.postcode}</span></div><div className="detail-row"><span>Location</span><span>Edinburgh, Scotland</span></div></section><section><h3>Main contact</h3><div className="detail-row"><span>Name</span><span>{c.contactName}</span></div><div className="detail-row"><span>Email</span><span>{c.email}</span></div><p className="muted text-xs leading-6">{c.description}</p></section></div><div className="preview-banner mt-6"><LockKeyhole/> Fictional charity and contact details · profile is read-only.</div></div></>;}
