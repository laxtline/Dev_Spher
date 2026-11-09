"""Merge additional local problem archives. Imported programs are never executed."""
import argparse, csv, hashlib, html, io, json, os, re, shutil, time
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from import_packs import clean, slugify, SKIP

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'
CODE={'.py','.java','.cpp','.cc','.c','.h','.hpp','.go','.js','.ts','.rs','.cs','.swift','.kt','.kts','.rb','.php','.scala','.sql','.sh','.rkt','.dart','.ex','.exs','.erl','.hs','.lua','.pl','.r','.m'}
TEXT=CODE|{'.md','.txt','.csv'}
IGNORE=SKIP|{'.agents','.claude','.github','.husky','.venv','venv','dist','build','coverage','node_modules','__tests__'}
ADMIN={'agents.md','claude.md','code_of_conduct.md','contributing.md','security.md','license.md','pull_request_template.md'}
OTHER={'lintcode','lcci','lcof','lcof2','lcp','lcs','basic','interview','contest','competition','weekly-contest','biweekly-contest'}
LANG={'python3':'py','python':'py','javascript':'js','typescript':'ts','c++':'cpp','csharp':'cs','c#':'cs','golang':'go','rust':'rs','kotlin':'kt','ruby':'rb','shell':'sh','bash':'sh'}
LANGUAGES={e[1:] for e in CODE}|set(LANG)
URL_RE=re.compile(r'https?://(?:www\.)?leetcode\.(?:com|cn)/problems/([a-z0-9-]+)',re.I)

def digest(value): return hashlib.sha256(value.encode('utf-8')).hexdigest()
def compact(value): return re.sub(r'[^a-z0-9]','',value.lower())
def jsonread(path,default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default
def atomic(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+'.merge-tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8'); temp.replace(path)
def pretty(stem):
    stem=re.sub(r'([a-z])([A-Z])',r'\1 \2',stem)
    return re.sub(r'[-_.]+',' ',stem).strip()
def normalized_code(language,code):
    return LANG.get(language.lower(),language.lower()),'\n'.join(line.rstrip() for line in code.replace('\r\n','\n').strip().splitlines())

class Merger:
    def __init__(self,data=DATA,root=ROOT):
        self.data=Path(data); self.root=Path(root)
        self.catalog=jsonread(self.data/'catalog.json')
        self.problems={p['id']:p for p in self.catalog['problems']}
        self.resources=self.catalog['resources']; self.details={}; self.changed=set()
        self.by_number={}; self.by_name={}; self.code_hashes={}
        for p in self.problems.values(): self.index(p)
        self.initial={k:len(v) for k,v in [('problems',self.problems),('resources',self.resources)]}
        self.manifest=jsonread(self.data/'imported-files.json',{'files':{},'content':{}})
        self.resource_hashes={}; self.resource_ids={r['id'] for r in self.resources}
        self.stats=Counter(); self.skipped=Counter(); self.examples=[]; self.collections=Counter()

    def index(self,p):
        if str(p['number']).isdigit(): self.by_number.setdefault(str(int(p['number'])),p['id'])
        self.by_name.setdefault(compact(p['slug']),p['id']); self.by_name.setdefault(compact(p['title']),p['id'])

    def detail(self,pid):
        if pid not in self.details:
            d=jsonread(self.data/'problems'/(pid+'.json'),{'html':'','source':'','solutions':[]})
            self.details[pid]=d
            self.code_hashes[pid]={digest('|'.join(normalized_code(s['language'],s['code']))) for s in d['solutions']}
            self.problems[pid]['solutions']=len(d['solutions'])
            self.problems[pid]['description']=bool(d['html'])
        return self.details[pid]

    def ensure(self,slug,number='',title=''):
        pid='lc-'+slug
        if pid not in self.problems and str(number).isdigit(): pid=self.by_number.get(str(int(number)),pid)
        if pid not in self.problems:
            self.problems[pid]={'id':pid,'number':str(int(number)) if str(number).isdigit() else '', 'slug':slug,'title':title or pretty(slug).title(),'difficulty':'Unknown','url':'https://leetcode.com/problems/'+slug+'/','acceptance':'','companies':{},'topics':[],'description':False,'solutions':0}
            self.index(self.problems[pid])
        return pid

    def identity(self,file,base,text=''):
        parts=file.relative_to(base).parts
        if any(part.lower() in OTHER or part.lower().startswith(('cpp-lcof','cpp-cc189','java-cc189')) for part in parts): return None
        candidates=[file.stem]+[p for p in reversed(parts[:-1])]
        number=''; title=''
        for part in candidates:
            m=re.match(r'^(?:task[_-])?0*(\d{1,5})(?:[. _-]+(.+))?$',part)
            if m and 0<int(m[1])<10000 and (not m[2] or not re.match(r'^\d+(?:[-_.]\d+)*$',m[2])):
                number=str(int(m[1])); title=pretty(m[2] or ''); break
        urls=list(dict.fromkeys(URL_RE.findall(text[:5000])))
        heading=re.search(r'^#{1,2}\s*\[?(\d+)\.\s*([^\]\n<]+)',text,re.M)
        if heading: number=str(int(heading[1])); title=heading[2].strip()
        if urls and (len(urls)==1 or heading):
            slug=urls[0]
            if 'lc-'+slug in self.problems: return 'lc-'+slug
            if number or re.match(r'^https?://',text.strip()): return self.ensure(slug,number,title)
        if title and compact(title) in self.by_name: return self.by_name[compact(title)]
        if number and number in self.by_number: return self.by_number[number]
        for part in candidates:
            key=compact(re.sub(r'(?:_test|\.test)$','',part))
            if key in self.by_name: return self.by_name[key]
        if number and title and re.search(r'[A-Za-z]{2}',title):
            return self.ensure(slugify(title),number,title)
        return None

    def solution(self,pid,code,language,name,source):
        if not code.strip(): return
        language,normalized=normalized_code(language,code)
        key=digest(language+'|'+normalized); d=self.detail(pid)
        if key in self.code_hashes[pid]: self.stats['duplicateSolutions']+=1; return
        self.code_hashes[pid].add(key)
        d['solutions'].append({'name':name,'language':language,'code':code,'source':source})
        self.problems[pid]['solutions']=len(d['solutions']); self.changed.add(pid); self.stats['solutionsAdded']+=1

    def image(self,source_path,base):
        try:
            file=source_path.resolve(); file.relative_to(base.resolve())
            if not file.is_file() or file.suffix.lower() not in {'.png','.jpg','.jpeg','.gif','.webp'}: return None
            raw=file.read_bytes(); key=hashlib.sha256(raw).hexdigest(); rel='assets/imported/'+key+file.suffix.lower(); dest=self.root/'web'/rel
            if not dest.exists(): dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(raw); self.stats['localDiagrams']+=1
            return '/'+rel
        except (OSError,ValueError): return None

    def markdown(self,text,file,base):
        # HTML is sanitized before insertion. Only explicitly copied local raster images get src attributes.
        images={}
        def img(match):
            raw=match.group(1); parsed=urlsplit(raw)
            if parsed.scheme or raw.startswith('//'): return '[Diagram available in the original source]'
            image=self.image(file.parent/unquote(parsed.path),base)
            if not image: return '[Diagram available in the original source]'
            key='LOCALDIAGRAM'+str(len(images))+'END'; images[key]='<img class="imported-diagram" src="'+html.escape(image,quote=True)+'" alt="Problem diagram" loading="lazy">'; return key
        text=re.sub(r'!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)',img,text)
        text=re.sub(r'<img\b[^>]*?src=["\']([^"\']+)["\'][^>]*>',img,text,flags=re.I)
        fences={}
        def fence(m):
            key='LOCALCODE'+str(len(fences))+'END'; fences[key]='<pre><code>'+html.escape(m[2])+'</code></pre>'; return key
        text=re.sub(r'```([^\n]*)\n(.*?)```',fence,text,flags=re.S)
        text=re.sub(r'(?m)^#{1,6}\s+(.+)$',lambda m:'<h3>'+m[1]+'</h3>',text)
        text=re.sub(r'(?m)^\s*[-*]\s+(.+)$',r'<p>• \1</p>',text)
        text=re.sub(r'\[([^\]\n]+)\]\([^\s)]+\)',r'\1',text)
        text=re.sub(r'`([^`\n]+)`',lambda m:'<code>'+html.escape(m[1])+'</code>',text)
        text=re.sub(r'\*\*([^*\n]+)\*\*',r'<strong>\1</strong>',text)
        text=text.replace('\n\n','<p></p>')
        text=clean(text)
        for key,value in fences.items(): text=text.replace(key,value)
        for key,value in images.items(): text=text.replace(key,value)
        return text

    def document(self,pid,text,file,base,source):
        p=self.problems[pid]; d=self.detail(pid)
        diff=re.search(r'^difficulty:\s*(Easy|Medium|Hard)|<h3>\s*(Easy|Medium|Hard)|\*\*Difficulty\*\*:\s*(Easy|Medium|Hard)',text,re.M|re.I)
        if diff and p['difficulty']=='Unknown': p['difficulty']=next(g for g in diff.groups() if g).title()
        tags=re.search(r'^tags:\s*\n((?:[ \t]+-[^\n]+\n)+)',text,re.M)
        if tags:
            for tag in re.findall(r'-\s*(.+)',tags[1]):
                if tag not in p['topics']: p['topics'].append(tag)
        for i,m in enumerate(re.finditer(r'```([A-Za-z+#]+)[^\n]*\n(.*?)```',text,re.S)):
            lang=m[1].lower()
            if lang in LANGUAGES: self.solution(pid,m[2],lang,f'{file.stem} · {LANG.get(lang,lang)} · {i+1}',source)
        body_match=re.search(r'<!--\s*description:start\s*-->(.*?)<!--\s*description:end\s*-->',text,re.S)
        body=body_match[1] if body_match else text
        if not body_match:
            body=re.sub(r'^---\n.*?\n---\n','',body,flags=re.S)
            body=re.split(r'(?m)^#{1,3}\s*(?:Solutions?|Approach|思路|解法|题解)\b',body,maxsplit=1)[0]
        is_statement=bool(body_match or re.search(r'\b(?:Input:|Output:|Constraints:|Given |You are given|Return |Description)\b',body)) and len(re.sub(r'<[^>]+>','',body))>100
        if is_statement and (not d['html'] or d.get('source')=='Local practice statement'):
            d['html']=self.markdown(body,file,base); d['source']=source; p['description']=True
            self.changed.add(pid); self.stats['statementsAdded']+=1
        elif not is_statement and text.strip():
            self.resource(text,file,source,base)

    def resource(self,text,file,source,base):
        # Content-identical copies share a resource; original collection/path remain visible.
        key=digest(file.suffix.lower()+'|'+text.strip())
        if key in self.resource_hashes: self.stats['duplicateResources']+=1; return
        rid='n'+key[:24]
        if rid in self.resource_ids: self.resource_hashes[key]=rid; self.stats['duplicateResources']+=1; return
        self.resource_hashes[key]=rid
        self.resource_ids.add(rid)
        self.resources.append({'id':rid,'title':str(file.relative_to(base)).replace('\\','/'),'collection':base.name,'company':'general','language':file.suffix.lower().lstrip('.'),'size':len(text.encode('utf-8')),'sourcePack':'New folder (2)'})
        atomic(self.data/'resources'/(rid+'.json'),{'text':text,'source':source})
        self.stats['resourcesAdded']+=1

    def attachment(self,file,source,base):
        raw=file.read_bytes(); key=hashlib.sha256(raw).hexdigest(); rid='n'+key[:24]
        if rid in self.resource_ids: self.stats['duplicateResources']+=1; return
        target=self.root/'web'/'assets'/'imported'/(key+'.pdf')
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists(): target.write_bytes(raw)
        self.resource_ids.add(rid)
        self.resources.append({'id':rid,'title':str(file.relative_to(base)).replace('\\','/'),'collection':base.name,'company':'general','language':'pdf','size':len(raw),'sourcePack':'New folder (2)'})
        atomic(self.data/'resources'/(rid+'.json'),{'source':source,'asset':'/assets/imported/'+target.name,'kind':'pdf'})
        self.stats['resourcesAdded']+=1; self.stats['pdfsAdded']+=1

    def csv(self,text,file):
        reader=csv.DictReader(io.StringIO(text)); count=0
        for row in reader:
            values={str(k).strip().lower():v for k,v in row.items() if k is not None}
            url=values.get('url') or values.get('link') or values.get('problem link') or ''
            match=URL_RE.search(url)
            title=values.get('title') or values.get('name')
            if not match or not title: continue
            pid=self.ensure(match[1],values.get('id') or values.get('number') or '',title)
            p=self.problems[pid]; diff=(values.get('difficulty') or '').title()
            if p['difficulty']=='Unknown' and diff in ('Easy','Medium','Hard'): p['difficulty']=diff
            if not p['acceptance']: p['acceptance']=values.get('acceptance %') or values.get('acceptance') or ''
            if 'frequency %' in values or 'frequency' in values:
                company=slugify(file.parent.name); period=file.stem
                c=p['companies'].setdefault(company,{'frequency':0,'periods':[]})
                try: c['frequency']=max(c['frequency'],float((values.get('frequency %') or values.get('frequency') or '0').replace('%','')))
                except ValueError: pass
                if period not in c['periods']: c['periods'].append(period)
            count+=1
        self.stats['sheetRowsRead']+=count
        return count

    def merge(self,folder,attachments_only=False):
        folder=Path(folder)
        if not folder.is_dir(): raise ValueError('Source folder not found: '+str(folder))
        bases=sorted([p for p in folder.iterdir() if p.is_dir()]) or [folder]
        # English full statements establish number/slug identity before bare solution filenames.
        bases.sort(key=lambda p:(0 if p.name=='leetcode-main' else 1,p.name.lower()))
        for base in bases:
            records=[]
            for current,dirs,files in os.walk(base):
                dirs[:]=sorted(d for d in dirs if d not in IGNORE and not d.endswith('_files'))
                for name in sorted(files):
                    file=Path(current)/name
                    if attachments_only and file.suffix.lower()!='.pdf': continue
                    if file.suffix.lower() not in TEXT|{'.pdf'} or name.lower() in ADMIN: self.skipped['assetsOrConfiguration']+=1; continue
                    if name.lower().endswith(('_test.go','.test.js','.test.ts','.spec.ts')): self.skipped['testHelpers']+=1; continue
                    records.append(file)
            records.sort(key=lambda p:(0 if p.name=='README_EN.md' else 1 if p.suffix.lower()=='.csv' else 2 if p.suffix.lower()=='.md' else 3,str(p).lower()))
            added_before=self.stats['solutionsAdded']+self.stats['statementsAdded']+self.stats['resourcesAdded']
            for file in records:
                self.stats['filesScanned']+=1
                if self.stats['filesScanned']%2000==0: print(json.dumps({'filesScanned':self.stats['filesScanned'],'solutionsAdded':self.stats['solutionsAdded'],'statementsAdded':self.stats['statementsAdded']}),flush=True)
                key=str(file.resolve()); stat=file.stat(); signature=[stat.st_size,stat.st_mtime_ns]
                if self.manifest['files'].get(key)==signature: self.stats['unchangedFiles']+=1; continue
                source=folder.name+'/'+str(file.relative_to(folder)).replace('\\','/')
                if file.suffix.lower()=='.pdf':
                    if stat.st_size>30000000: self.skipped['largePdfFiles']+=1; continue
                    self.attachment(file,source,base); self.manifest['files'][key]=signature; continue
                if stat.st_size>2000000: self.skipped['largeTextFiles']+=1; continue
                text=file.read_text(encoding='utf-8-sig',errors='replace')
                if not text.strip(): self.skipped['emptyFiles']+=1; continue
                content=digest(file.suffix.lower()+'|'+text.replace('\r\n','\n').strip())
                source=folder.name+'/'+str(file.relative_to(folder)).replace('\\','/')
                if content in self.manifest['content']:
                    self.stats['duplicateFiles']+=1; self.manifest['files'][key]=signature; continue
                if file.suffix.lower()=='.csv' and self.csv(text,file): pass
                else:
                    pid=self.identity(file,base,text)
                    if pid and file.suffix.lower()=='.md': self.document(pid,text,file,base,source)
                    elif pid and file.suffix.lower() in CODE:
                        self.solution(pid,text,file.suffix.lower()[1:],file.name,source)
                    else: self.resource(text,file,source,base)
                self.manifest['content'][content]=source; self.manifest['files'][key]=signature
            self.collections[base.name]+=self.stats['solutionsAdded']+self.stats['statementsAdded']+self.stats['resourcesAdded']-added_before
            print(json.dumps({'collection':base.name,'added':self.collections[base.name],'scanned':len(records)}),flush=True)

    def finish(self,sources):
        backup=self.data/'backups'/('merge-'+time.strftime('%Y%m%d-%H%M%S'))
        backup.mkdir(parents=True,exist_ok=True)
        for name in ('catalog.json','import-report.json','imported-files.json'):
            if (self.data/name).exists(): shutil.copy2(self.data/name,backup/name)
        for pid in self.changed:
            path=self.data/'problems'/(pid+'.json')
            if path.exists(): (backup/'problems').mkdir(exist_ok=True); shutil.copy2(path,backup/'problems'/path.name)
            atomic(path,self.details[pid])
        problems=sorted(self.problems.values(),key=lambda p:(int(p['number']) if str(p['number']).isdigit() else 999999,p['title']))
        companies={}
        for p in problems:
            for company in p['companies']: companies[company]=companies.get(company,0)+1
        report=self.catalog['report'].copy()
        report.update({'problems':len(problems),'companies':len(companies),'descriptions':sum(bool(p['description']) for p in problems),'withSolutions':sum(bool(p['solutions']) for p in problems),'resources':len(self.resources),'solutionVariants':sum(p['solutions'] for p in problems)})
        report['sources']=list(dict.fromkeys(report.get('sources',[])+[Path(s).name for s in sources]))
        previous=report.get('additionalImports',{})
        for source in sources: previous[str(Path(source))]={'addedProblems':len(self.problems)-self.initial['problems'],'lastMerged':time.strftime('%Y-%m-%d %H:%M:%S'),'stats':dict(self.stats)}
        report['additionalImports']=previous
        self.catalog.update({'problems':problems,'companies':[{'slug':k,'count':v} for k,v in sorted(companies.items())],'resources':self.resources,'report':report})
        atomic(self.data/'import-report.json',report)
        atomic(self.data/'catalog.json',self.catalog)
        atomic(self.data/'imported-files.json',self.manifest)
        result={'addedProblems':len(self.problems)-self.initial['problems'],'stats':dict(self.stats),'skipped':dict(self.skipped),'totals':{k:report[k] for k in ['problems','companies','descriptions','withSolutions','solutionVariants','resources']},'backup':str(backup)}
        atomic(self.data/'last-merge-report.json',result)
        print(json.dumps(result,indent=2),flush=True)
        return result

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('folders',nargs='*'); parser.add_argument('--attachments-only',action='store_true'); args=parser.parse_args()
    folders=args.folders or jsonread(ROOT/'import_sources.json',{}).get('additional_folders',[])
    if not folders: raise SystemExit('No additional source folders configured.')
    merger=Merger()
    for folder in folders: merger.merge(folder,args.attachments_only)
    merger.finish(folders)

if __name__=='__main__': main()
