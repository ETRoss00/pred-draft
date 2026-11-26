"use client";

import { useMemo, useState } from 'react';
import { heroes, roles, type Hero, type Role } from '@/data/predecessor/audit';
import { analyzeDraft, heroFitsRole, isVerified, rankAugments, rankBlessings, rankEternals, rankHeroes, type DraftAdvice } from '@/data/predecessor/draft';

export default function DraftClient() {
  const [role, setRole] = useState<Role>('carry');
  const [enemyNames, setEnemyNames] = useState<string[]>(['', '', '', '', '']);
  const [heroName, setHeroName] = useState('');
  const [augmentName, setAugmentName] = useState('');
  const [eternalId, setEternalId] = useState('');
  const [blessing1Id, setBlessing1Id] = useState('');
  const [blessing2Id, setBlessing2Id] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const picks = useMemo(() => enemyNames.map(name => ({ name })), [enemyNames]);
  const comp = useMemo(() => analyzeDraft(picks), [picks]);
  const pool = heroes.filter(h => isVerified(h) && heroFitsRole(h, role) && !enemyNames.includes(h.name));
  const hero = pool.find(h => h.name === heroName);
  const candidates = useMemo(() => rankHeroes(picks, role, search), [picks, role, search]);
  const augments = useMemo(() => hero ? rankAugments(picks, hero, role) : [], [picks, hero, role]);
  const augment = hero?.augments?.find(a => a.name === augmentName);
  const eternalOptions = useMemo(() => hero && augment ? rankEternals(picks, hero, role, augment) : [], [picks, hero, role, augment]);
  const eternal = eternalOptions.find(e => e.option.id === eternalId)?.option;
  const blessing1 = useMemo(() => hero && eternal ? rankBlessings(eternal, 1, picks, hero, role, augment) : [], [hero, eternal, picks, role, augment]);
  const blessing2 = useMemo(() => hero && eternal ? rankBlessings(eternal, 2, picks, hero, role, augment) : [], [hero, eternal, picks, role, augment]);

  function clearEternal() { setEternalId(''); setBlessing1Id(''); setBlessing2Id(''); }
  function chooseHero(name: string) {
    setHeroName(name); setAugmentName(''); clearEternal(); setExpanded({});
  }
  function changeRole(next: Role) {
    setRole(next);
    if (hero && !heroFitsRole(hero, next)) chooseHero('');
  }
  function changeEnemy(index: number, name: string) {
    if (name && (name === heroName || enemyNames.some((n,i) => i !== index && n === name))) return;
    setEnemyNames(current => current.map((n,i) => i === index ? name : n));
  }
  const count = comp.enemies.length;
  const traits = [...comp.threatCounts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  const controlClass = 'h-12 w-full min-w-0 rounded-md border border-[#d4d4ce] bg-white px-3 text-base';

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#191712]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-[#d4d4ce] pb-5">
          <div><p className="text-sm font-semibold text-[#8a3524]">Kit draft lab</p><h1 className="text-2xl font-black">Predecessor Counterpick</h1></div>
          <span className="shrink-0 rounded-md bg-[#191712] px-3 py-2 text-sm font-bold text-white">{count}/5 enemy</span>
        </header>

        <div className="grid grid-cols-2 items-start gap-4 sm:gap-6">
          <section className="min-w-0"><label className="mb-2 block text-base font-bold" htmlFor="my-role">My Role</label>
            <select id="my-role" value={role} onChange={e=>changeRole(e.target.value as Role)} className={controlClass}>
              {roles.map(r=><option key={r} value={r}>{format(r)}</option>)}
            </select>
          </section>
          <section className="min-w-0" aria-live="polite"><h2 className="mb-2 text-base font-bold">Enemy Read</h2>
            <div className="flex flex-wrap gap-2">{traits.length ? traits.map(([trait,n])=><span key={trait} className="rounded bg-[#e9f0dd] px-2 py-1 text-sm font-semibold">{format(trait)} ×{n}</span>) : <p className="text-sm text-[#665f52]">Enemy matchup unknown</p>}</div>
          </section>
          <section className="min-w-0"><label className="mb-2 block text-base font-bold" htmlFor="my-hero">My Hero</label>
            <select id="my-hero" value={hero?.name ?? ''} onChange={e=>chooseHero(e.target.value)} className={controlClass}>
              <option value="">Choose during draft</option>{pool.map(h=><option key={h.id} value={h.name}>{h.name}</option>)}
            </select>
          </section>
          <section className="min-w-0"><h2 className="mb-2 text-base font-bold">Enemy Team</h2><div className="space-y-2">
            {enemyNames.map((name,index)=><select key={index} aria-label={`Enemy pick ${index+1}`} value={name} onChange={e=>changeEnemy(index,e.target.value)} className={controlClass}>
              <option value="">Enemy pick {index+1}</option>{heroes.filter(isVerified).map(h=><option key={h.id} value={h.name} disabled={h.name===heroName || (enemyNames.includes(h.name) && name!==h.name)}>{h.name}</option>)}
            </select>)}
          </div></section>
        </div>

        {!hero && <section className="mt-8 border-t border-[#d4d4ce] pt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">Recommended Heroes</h2><input aria-label="Filter heroes" placeholder="Filter heroes" value={search} onChange={e=>setSearch(e.target.value)} className="h-11 w-48 max-w-full rounded-md border border-[#d4d4ce] bg-white px-3 text-base" /></div>
          <div className="grid gap-3 sm:grid-cols-2">{candidates.slice(0,8).map(advice=><HeroChoice key={advice.option.id} advice={advice} onSelect={()=>chooseHero(advice.option.name)} />)}</div>
          {!candidates.length && <p className="text-base text-[#665f52]">No available heroes match this role and filter.</p>}
        </section>}

        {hero && <>
          <Choices title="Recommended Augments" choices={augments} selected={augmentName} expanded={!!expanded.augment} onExpand={()=>setExpanded(s=>({...s,augment:true}))}
            onSelect={a=>{setAugmentName(a.name);clearEternal();setExpanded({});}} identity={a=>a.name} description={a=>a.description} />
          {augment && <Choices title="Recommended Eternals" choices={eternalOptions} selected={eternalId} expanded={!!expanded.eternal} onExpand={()=>setExpanded(s=>({...s,eternal:true}))}
            onSelect={e=>{setEternalId(e.id);setBlessing1Id('');setBlessing2Id('');setExpanded(s=>({...s,eternal:false,blessing1:false,blessing2:false}));}} identity={e=>e.id} description={e=>e.mainTrait.description} />}
          {eternal && <>
            <Choices title="Minor Blessing 1" choices={blessing1} selected={blessing1Id} expanded={!!expanded.blessing1} onExpand={()=>setExpanded(s=>({...s,blessing1:true}))}
              onSelect={b=>{setBlessing1Id(b.id!);setExpanded(s=>({...s,blessing1:false}));}} identity={b=>b.id!} description={b=>b.description} />
            <Choices title="Minor Blessing 2" choices={blessing2} selected={blessing2Id} expanded={!!expanded.blessing2} onExpand={()=>setExpanded(s=>({...s,blessing2:true}))}
              onSelect={b=>{setBlessing2Id(b.id!);setExpanded(s=>({...s,blessing2:false}));}} identity={b=>b.id!} description={b=>b.description} />
          </>}
        </>}
      </div>
    </main>
  );
}

function HeroChoice({advice,onSelect}:{advice:DraftAdvice<Hero>;onSelect:()=>void}) {
  return <button type="button" onClick={onSelect} className="min-w-0 rounded-lg border border-[#d4d4ce] bg-white p-4 text-left hover:border-[#8a3524]">
    <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{advice.option.name}</h3><Score score={advice.score}/></div>
    <p className="mt-1 text-sm text-[#665f52]">{advice.option.roles.map(format).join(' / ')}</p><Reasons reasons={advice.reasons}/>
  </button>;
}

function Choices<T extends {name:string}>({title,choices,selected,expanded,onExpand,onSelect,identity,description}:{
  title:string;choices:DraftAdvice<T>[];selected:string;expanded:boolean;onExpand:()=>void;onSelect:(option:T)=>void;identity:(option:T)=>string;description:(option:T)=>string;
}) {
  const visible=selected&&!expanded?choices.filter(c=>identity(c.option)===selected):choices;
  return <section className="mt-8 border-t border-[#d4d4ce] pt-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-black">{title}</h2>{selected&&!expanded&&<button type="button" onClick={onExpand} className="min-h-11 px-3 text-base font-semibold text-[#8a3524] underline">Change</button>}</div>
    <div className="grid gap-3 sm:grid-cols-2">{visible.map(advice=><button type="button" key={identity(advice.option)} disabled={!advice.eligible} aria-pressed={identity(advice.option)===selected} onClick={()=>onSelect(advice.option)}
      className={`min-w-0 rounded-lg border bg-white p-4 text-left disabled:opacity-60 ${identity(advice.option)===selected?'border-2 border-[#8a3524]':'border-[#d4d4ce] hover:border-[#8a3524]'}`}>
      <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{advice.option.name}</h3><Score score={advice.score}/></div>
      <p className="mt-2 break-words text-base leading-relaxed text-[#4a493f]">{description(advice.option)}</p><Reasons reasons={advice.reasons}/>
    </button>)}</div>
  </section>;
}

function Score({score}:{score:number}) {return <span className="shrink-0 rounded bg-[#191712] px-2 py-1 text-sm font-bold text-white">Fit {score}</span>;}
function Reasons({reasons}:{reasons:string[]}) {return <ul className="mt-3 space-y-1 text-sm text-[#46562c]">{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>;}
function format(text:string) {return text.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());}
