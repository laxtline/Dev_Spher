"""Consolidate repeated question titles and retain every source, answer and old ID.

Different tasks under one title remain source variants, never discarded. Operators
and digits inside titles are significant (I/II, n/k, / // %, etc. stay distinct).
"""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from expand_library import ROOT, read, write


def identity(title):
    title=title.lower().strip()
    title=re.sub(r'^(?:trace, implement and test:|explain and practise:)\s*','',title)
    title=re.sub(r'^(?:(?:exercise|question|q)\s*)?\d+\s*[:.)-]\s*','',title)
    title=re.sub(r'\s+(?:in|using)\s+(?:python|java|javascript|c\+\+|cpp)\s*[.?!]*$','',title)
    return re.sub(r'[^\w+*/%<>=!&|]+','',title,flags=re.UNICODE).replace('_','')


def priority(p):
    return (0 if p['id'].startswith('lc-') else 1 if p.get('runnable') else 2 if p.get('sourceGroup')=='python-pack' else 3 if p.get('recordType','').endswith('question') else 4 if p.get('recordType')!='source-link' else 5, p['id'])


def deduplicate(root=ROOT):
    root=Path(root);data=root/'data';catalog=read(data/'catalog.json')
    groups=defaultdict(list)
    for p in catalog['problems']:
        ident=identity(p['title'])
        groups[ident or p['title'].lower()].append(p)
    # Known renamed LeetCode question, confirmed against retained source metadata.
    a=next((p for p in catalog['problems'] if p['id']=='lc-implement-strstr'),None)
    b=next((p for p in catalog['problems'] if p['id']=='lc-find-the-index-of-the-first-occurrence-in-a-string'),None)
    if a and b:
        groups[identity(b['title'])].extend(groups.pop(identity(a['title'])))
    aliases={};rows=[];merged=[]
    previous=read(data/'library-deduplication-report.json') if (data/'library-deduplication-report.json').exists() else {}
    for group in groups.values():
        group.sort(key=priority)
        main=group[0]
        for aid in main.get('aliasIds',[]): aliases[aid]=main['id']
        if len(group)>1:
            dest=data/'problems'/f"{main['id']}.json"
            d=read(dest) if dest.exists() else dict(html='',source='',solutions=[])
            variants=d.setdefault('variants',[])
            def document_key(v): return hashlib.sha256((v.get('html','')+'|'+v.get('sourceAsset','')).encode()).hexdigest()
            docs={document_key(d)}|{document_key(v) for v in variants}
            codes={s.get('language','')+'|'+s['code'].strip() for s in d['solutions']}
            main.setdefault('sourceGroups',list(filter(None,[main.get('sourceGroup')])))
            main.setdefault('packIds',list(filter(None,[main.get('packId')])))
            for p in group[1:]:
                main.setdefault('aliasIds',[])
                for aid in [p['id']]+p.get('aliasIds',[]):
                    if aid not in main['aliasIds']:main['aliasIds'].append(aid)
                    aliases[aid]=main['id']
                for field in ['topics','resourceIds','sourceGroups','packIds']:
                    incoming=p.get(field,[])
                    if field=='sourceGroups':incoming=list(dict.fromkeys(incoming+list(filter(None,[p.get('sourceGroup')]))))
                    if field=='packIds':incoming=list(dict.fromkeys(incoming+list(filter(None,[p.get('packId')]))))
                    main[field]=list(dict.fromkeys(main.get(field,[])+incoming))
                main.setdefault('aliasTitles',[])
                main['aliasTitles']=list(dict.fromkeys(main['aliasTitles']+[p['title']]+p.get('aliasTitles',[])))
                for company,values in p.get('companies',{}).items():
                    if company not in main['companies']:main['companies'][company]=values
                path=data/'problems'/f"{p['id']}.json"
                other=read(path) if path.exists() else dict(html='',source=p.get('sourceLabel',''),solutions=[])
                for v in [other]+other.get('variants',[]):
                    v={k:v[k] for k in ['html','source','sourceAsset','sourcePages'] if k in v}
                    signature=document_key(v)
                    if v.get('html') and signature not in docs:
                        docs.add(signature);variants.append(v)
                for solution in other.get('solutions',[]):
                    signature=solution.get('language','')+'|'+solution['code'].strip()
                    if signature not in codes:codes.add(signature);d['solutions'].append(solution)
                if other.get('practice') and not d.get('practice'):
                    d['practice']=other['practice'];d['starter']=other.get('starter',{})
                if other.get('sourceAsset') and not d.get('sourceAsset'):
                    d['sourceAsset']=other['sourceAsset'];d['sourcePages']=other.get('sourcePages',[])
                # Retain the alias file for pre-existing deep links and future reimport.
                merged.append(dict(kept=main['id'],merged=p['id'],title=p['title']))
            main['solutions']=len(d['solutions'])
            main['runnable']=bool(d.get('practice') or main.get('runnable'))
            write(dest,d)
        rows.append(main)
    # Correct a supplied archive's wrong number using the independently retained metadata.
    legacy=(root/'web/studio/offline/catalog.js').read_text(encoding='utf-8')
    legacy_number=re.search(r'"number":(\d+),"title":"Encode N-ary Tree to Binary Tree"',legacy)
    for p in rows:
        if p['id']=='lc-encode-n-ary-tree-to-binary-tree' and legacy_number:p['number']=legacy_number[1]
    for r in catalog['resources']:
        r['questionIds']=list(dict.fromkeys(aliases.get(pid,pid) for pid in r.get('questionIds',[])))
    catalog['problems']=rows
    catalog['report']['problems']=len(rows)
    report=dict(originalRecords=previous.get('originalRecords',len(read(data/'catalog.json')['problems'])),
                canonicalQuestions=len(rows),mergedRecords=len(aliases),
                duplicateTitleGroupsRemaining=sum(len(g)>1 for g in _groups(rows).values()),
                aliases=aliases,merged=list({m['merged']:m for m in previous.get('merged',[])+merged}.values()),
                policy='Normalized repeated titles and confirmed renamed questions are grouped. All original statements, tests, answers, implementations and source links are retained as variants. Distinct operators, numbered variants and different task titles remain separate.')
    catalog['report']['deduplication']={k:v for k,v in report.items() if k not in {'aliases','merged'}}
    write(data/'catalog.json',catalog)
    write(data/'library-deduplication-report.json',report)
    print(json.dumps({k:v for k,v in report.items() if k not in {'aliases','merged'}},indent=2))
    return report


def _groups(rows):
    groups=defaultdict(list)
    for p in rows:
        ident=identity(p['title']);groups[ident or p['title'].lower()].append(p['id'])
    return groups


if __name__=='__main__':deduplicate()
