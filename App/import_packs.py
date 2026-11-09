"""Import the user's existing interview collections without executing their code."""
import csv, html, json, re, shutil
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
PACK_A = Path.home()/'Downloads'/'Leetcode-Premium-InterviewSheets-main'/'Leetcode-Premium-InterviewSheets-main'
PACK_B = Path.home()/'Downloads'/'service based 1'/'service based 1'
SERVICE = ('accenture', 'cognizant', 'infosys', 'infytq', 'mindtree', 'capgemini', 'tcs', 'mahindra', 'wipro', 'interview-prep', 'programming-aptitude', 'tech-interview-handbook', 'interview-rounds')
CODE_EXT = {'.py', '.cpp', '.java', '.js', '.sql', '.c', '.cs', '.txt', '.md'}
SKIP = {'node_modules', '.git', 'site', 'bin', 'obj', 'target', 'vendor', 'packages', '.idea', '.vscode', '__pycache__'}

class CleanHTML(HTMLParser):
    tags = {'p','div','span','strong','b','em','i','code','pre','ul','ol','li','h1','h2','h3','h4','br','hr','table','thead','tbody','tr','td','th','sup','sub','blockquote','details','summary'}
    def __init__(self):
        super().__init__(convert_charrefs=True); self.out=[]; self.hidden=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','iframe','object'): self.hidden+=1
        if self.hidden: return
        if tag in self.tags: self.out.append('<'+tag+'>')
        if tag == 'img': self.out.append('<p class="image-note">[Diagram in original source]</p>')
    def handle_endtag(self, tag):
        if tag in ('script','style','iframe','object'): self.hidden=max(0,self.hidden-1); return
        if not self.hidden and tag in self.tags: self.out.append('</'+tag+'>')
    def handle_data(self, value):
        if not self.hidden: self.out.append(html.escape(value))

def clean(value):
    p=CleanHTML(); p.feed(value); return ''.join(p.out)

def slugify(value): return re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-')
def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def main():
    if not PACK_A.is_dir() or not PACK_B.is_dir(): raise SystemExit('A question pack folder was not found. Update PACK_A/PACK_B in import_packs.py.')
    problems={}; companies={}; links=0
    for file in sorted(PACK_A.glob('*/*.csv')):
        company=file.parent.name; period=file.stem
        for row in csv.DictReader(file.read_text(encoding='utf-8-sig').splitlines()):
            url=row.get('URL',''); slug=url.rstrip('/').split('/')[-1]
            if not slug or not row.get('Title'): continue
            pid='lc-'+slug
            p=problems.setdefault(pid,{'id':pid,'number':row.get('ID',''),'slug':slug,'title':row['Title'],'difficulty':row.get('Difficulty','Unknown'),'url':url,'acceptance':row.get('Acceptance %',''),'companies':{},'topics':[],'description':False,'solutions':0})
            c=p['companies'].setdefault(company,{'frequency':0,'periods':[]})
            try: c['frequency']=max(c['frequency'],float(row.get('Frequency %','0').replace('%','')))
            except ValueError: pass
            if period not in c['periods']: c['periods'].append(period)
            companies.setdefault(company,set()).add(pid); links+=1
    details={}; imported=0
    # Only read problem archives. Browser bypass extensions and unrelated apps are excluded.
    archives=['Complete-LeetCode-Premium-Problems-master','Leetcode-Premium-main','LeetCode-Solutions-main','leetcode-primer-main']
    for archive in archives:
        base=PACK_B/archive
        if not base.exists(): continue
        for file in sorted(base.rglob('*.md')):
            if any(x in SKIP for x in file.relative_to(base).parts) or file.stat().st_size>300000: continue
            value=file.read_text(encoding='utf-8',errors='replace')
            match=re.search(r'https?://leetcode.com/problems/([a-z0-9-]+)',value)
            if not match or len(value)<150: continue
            slug=match[1]; pid='lc-'+slug
            # A top-level list of links is not a problem statement.
            if file.parent==base or len(re.findall(r'https?://leetcode.com/problems/',value))>8: continue
            title=re.search(r'<h[12][^>]*>.*?(\d+)\.\s*([^<]+)',value,re.S)
            number=title[1] if title else (re.match(r'(\d+)',file.parent.name)[1] if re.match(r'(\d+)',file.parent.name) else '')
            p=problems.setdefault(pid,{'id':pid,'number':number,'slug':slug,'title':html.unescape(title[2]).strip() if title else slug.replace('-',' ').title(),'difficulty':'Unknown','url':'https://leetcode.com/problems/'+slug+'/','acceptance':'','companies':{},'topics':[],'description':False,'solutions':0})
            diff=re.search(r'<h3>\s*(Easy|Medium|Hard)\s*</h3>|Difficulty:\s*(Easy|Medium|Hard)',value,re.I)
            if diff: p['difficulty']=(diff[1] or diff[2]).title()
            d=details.setdefault(pid,{'html':'','source':'','solutions':[]})
            if not d['html']:
                d['html']=clean(value) if re.search(r'<(?:p|div|h2)>',value) else '<pre class="markdown">'+html.escape(value)+'</pre>'
                d['source']=archive+'/'+str(file.relative_to(base)).replace('\\','/'); p['description']=True; imported+=1
            for code in sorted(file.parent.iterdir()):
                if code.suffix not in CODE_EXT-{'.md','.txt'} or not code.is_file() or code.stat().st_size>100000: continue
                if any(x['name']==code.name for x in d['solutions']): continue
                d['solutions'].append({'name':code.name,'language':code.suffix.lstrip('.'),'code':code.read_text(encoding='utf-8',errors='replace'),'source':archive})
            p['solutions']=len(d['solutions'])
    curated=json.loads((ROOT/'practice.json').read_text(encoding='utf-8'))
    for spec in curated:
        pid='lc-'+spec['slug']; p=problems[pid]
        p['runnable']=True; p['topics']=spec['topics']
        d=details.setdefault(pid,{'html':'','source':'','solutions':[]})
        if not d['html']:
            d['html']='<p>'+html.escape(spec['description'])+'</p>'+''.join('<h3>Example '+str(i+1)+'</h3><pre>Input: '+html.escape(json.dumps(t['args']))+'\nOutput: '+html.escape(json.dumps(t['expected']))+'</pre>' for i,t in enumerate(spec['tests'][:2]))
            d['source']='Local practice statement'; p['description']=True
        d['practice']=spec
    resources=[]
    for base in sorted(PACK_B.iterdir()):
        if not base.is_dir() or not any(x in base.name.lower() for x in SERVICE): continue
        company=next((x for x in ['accenture','cognizant','infosys','mindtree','capgemini','tcs','mahindra','wipro'] if x in base.name.lower()),'general')
        if 'infytq' in base.name.lower(): company='infosys'
        for file in sorted(base.rglob('*')):
            if not file.is_file() or file.suffix.lower() not in CODE_EXT or any(x in SKIP or x.endswith('_files') for x in file.relative_to(base).parts): continue
            if not 10<file.stat().st_size<220000: continue
            rel=str(file.relative_to(base)).replace('\\','/')
            rid='r'+str(len(resources)+1)
            resources.append({'id':rid,'title':rel,'collection':base.name,'company':company,'language':file.suffix.lstrip('.'),'size':file.stat().st_size})
            write(DATA/'resources'/f'{rid}.json',{'text':file.read_text(encoding='utf-8',errors='replace'),'source':base.name+'/'+rel})
    for pid,d in details.items(): write(DATA/'problems'/f'{pid}.json',d)
    catalog=sorted(problems.values(),key=lambda p:(int(p['number']) if str(p['number']).isdigit() else 999999,p['title']))
    report={'problems':len(catalog),'companies':len(companies),'descriptions':sum(p['description'] for p in catalog),'withSolutions':sum(bool(p['solutions']) for p in catalog),'practiceSuites':len(curated),'resources':len(resources),'snapshot':'12 July 2025 (company sheets)','sources':[PACK_A.name,PACK_B.name],'csvRowsRead':links}
    write(DATA/'catalog.json',{'problems':catalog,'companies':[{'slug':k,'count':len(v)} for k,v in sorted(companies.items())],'resources':resources,'report':report})
    write(DATA/'import-report.json',report)
    print(json.dumps(report,indent=2))
    # Reapply configured extra archives after rebuilding the original collections.
    config=ROOT/'import_sources.json'
    if config.exists():
        from merge_packs import Merger
        folders=json.loads(config.read_text(encoding='utf-8')).get('additional_folders',[])
        existing=[folder for folder in folders if Path(folder).is_dir()]
        if existing:
            # Fresh original data needs full replay, including files seen in a previous import.
            merger=Merger(); merger.manifest={'files':{},'content':{}}
            for folder in existing: merger.merge(folder)
            merger.finish(existing)

if __name__=='__main__': main()
