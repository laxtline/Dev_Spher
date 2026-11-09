"""Build question records from local study material; never execute imported programs.

Run with the bundled authoring Python (pypdf is needed for book extraction).
Sources stay intact. Generated exercises and estimated difficulties are explicit.
Stable IDs make reimports safe for saved progress, notes and bookmarks.
"""
import argparse
import ast
import hashlib
import html
import json
import re
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PACK = ROOT.parent.parent / 'python-dsa-pack-20261031'
WORK = ROOT.parent.parent / 'python-dsa-pack-work'
CODE = {'py','java','cpp','c','h','hpp','go','swift','ts','js','cs','sql','rs','rb','php','kt','sh'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if not path.exists() or path.read_text(encoding='utf-8') != raw:
        temp = path.with_suffix('.tmp')
        temp.write_text(raw, encoding='utf-8')
        temp.replace(path)


def key(text):
    return re.sub(r'[\W_]+', '', text.lower(), flags=re.UNICODE)


def plain(text):
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', html.unescape(text).strip(' #*`|\t\n'))


def title_for(resource, text):
    match = re.search(r'^#\s+(.+)$', text, re.M)
    if match and len(plain(match[1])) > 3:
        return re.sub(r'^\d+[.、]\s*', '', plain(match[1]))[:200]
    path = Path(resource['title'])
    stem = path.stem
    if stem.lower() in {'readme','readme_en','solution','main','index'} or stem.isdigit():
        stem = path.parent.name or stem
    stem = re.sub(r'([a-z])([A-Z])', r'\1 \2', stem)
    return re.sub(r'[-_]+', ' ', stem).strip()[:200] or 'Source practice'


def classify(title, context='', explicit=''):
    words = title + ' ' + context[:1800]
    tags = []
    rules = [
        ('Python', r'python|\bdef\s|pydsa'), ('Patterns', r'pattern|pyramid|diamond|triangle|butterfly|rhombus'),
        ('Array', r'array|matrix|\blists?\b|数组|矩阵'), ('String', r'string|palindrome|anagram|字符串'),
        ('Hash Table', r'hash|dictionar|\bsets?\b|frequency|哈希'), ('Linked List', r'linked.?list|链表'),
        ('Stack', r'stack|bracket|parenthes|单调栈|栈'), ('Queue', r'queue|队列'),
        ('Tree', r'\btree\b|\bbst\b|二叉树'), ('Graph', r'graph|dijkstra|topological|\bbfs\b|\bdfs\b|图论'),
        ('Dynamic Programming', r'dynamic programming|\bdp\b|knapsack|memoiz|动态规划'),
        ('Binary Search', r'binary.?search|二分'), ('Sorting', r'sort|排序'),
        ('Heap (Priority Queue)', r'heap|priority.?queue|之堆'), ('Bit Manipulation', r'bitwise|bit.?operation|bit.?manipulation|位运算'),
        ('Recursion', r'recurs|递归'), ('Backtracking', r'backtrack|permutation|回溯'),
        ('Database', r'\bsql\b|database|数据库'), ('Object-oriented programming', r'\boop\b|inheritance|polymorphism|encapsulation|java programmers'),
        ('Math', r'prime|factorial|fibonacci|number|integer|math|数字'),
        ('Interview theory', r'interview|difference|explain|what is|what are|面试'),
    ]
    for tag, pattern in rules:
        if re.search(pattern, words, re.I): tags.append(tag)
    if not tags: tags = ['Programming fundamentals']
    match = re.search(r'\b(Easy|Medium|Hard)\b|简单|中等|困难', explicit, re.I)
    if match:
        difficulty = {'简单':'Easy','中等':'Medium','困难':'Hard'}.get(match[0], match[0].title())
        return tags, difficulty, 'Source supplied'
    hard = re.search(r'segment tree|suffix array|advanced|bellman|floyd|minimum spanning|bit.?operation|staff|senior', title, re.I)
    medium = {'Graph','Tree','Dynamic Programming','Heap (Priority Queue)','Backtracking','Object-oriented programming'} & set(tags)
    return tags, 'Hard' if hard else 'Medium' if medium else 'Easy', 'Estimated study difficulty'


class Expansion:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.data = self.root/'data'
        self.catalog = read(self.data/'catalog.json')
        self.problems = {p['id']:p for p in self.catalog['problems']}
        self.titles = {key(p['title']):p['id'] for p in self.problems.values() if not p.get('libraryExpansion')}
        self.numbers = {str(p['number']):p['id'] for p in self.problems.values() if p.get('number') and p['id'].startswith('lc-')}
        self.counts = Counter()
        self.coverage = []

    def add(self, pid, title, body, source, topics=None, difficulty='', record_type='extracted', **extra):
        tags, level, basis = classify(title, source, difficulty)
        p = dict(id=pid, number='', slug=pid, title=title, difficulty=level,
                 difficultyBasis=basis, companies={}, topics=topics or tags, description=bool(body),
                 solutions=0, url='', libraryExpansion=True, recordType=record_type,
                 sourceLabel=source, **extra)
        self.problems[pid] = p
        detail = dict(html=body, source=source, solutions=[])
        write(self.data/'problems'/f'{pid}.json', detail)
        return p, detail

    def link(self, pid, resource):
        p = self.problems[pid]
        ids = p.setdefault('resourceIds', [])
        if resource['id'] not in ids: ids.append(resource['id'])
        resource.setdefault('questionIds', [])
        if pid not in resource['questionIds']: resource['questionIds'].append(pid)

    def existing(self, title, text='', path=''):
        urls = list(dict.fromkeys(re.findall(r'https?://(?:www\.)?leetcode\.(?:com|cn)/problems/([\w-]+)', text[:6000])))
        if len(urls) == 1 and 'lc-'+urls[0] in self.problems:
            return 'lc-'+urls[0]
        name = key(re.sub(r'^\d+[.\s_-]+', '', title))
        if name in self.titles: return self.titles[name]
        # Number-only matching is limited to explicitly LeetCode paths, never LCOF/LCCI etc.
        if re.search(r'leetcode', path, re.I) and not re.search(r'lcof|lcci|lintcode|interview|面试|剑指|lcp|contest', path, re.I):
            numbers = re.findall(r'(?:^|[/\\])0*(\d{1,4})(?=[. _/\\-]|$)', path)
            if numbers and str(int(numbers[-1])) in self.numbers: return self.numbers[str(int(numbers[-1]))]
        return None

    def pack(self, pack=PACK, work=WORK):
        questions = read(pack/'combined/questions.json')
        for q in questions:
            pid = 'pack-'+q['id'].lower()
            e = html.escape
            body = '<p>'+e(q['statement'])+'</p>'
            if q.get('input_convention'): body += '<p>'+e(q['input_convention'])+'</p>'
            for example in q.get('examples', []):
                body += '<h3>Example</h3><pre>'+e(json.dumps(example, ensure_ascii=False, indent=2))+'</pre>'
            if q.get('hint'): body += '<details><summary>Hint</summary><p>'+e(q['hint'])+'</p></details>'
            if q.get('complexity'): body += '<p>Complexity: '+e(q['complexity'])+'</p>'
            if q.get('answer_text'): body += '<details><summary>Supplied answer</summary><pre>'+e(q['answer_text'])+'</pre></details>'
            body += '<p>'+e(q.get('answer_verification',''))+'</p>'
            topics, _, _ = classify(q['title'], q.get('topic','')+' '+q['statement'])
            topics = list(dict.fromkeys(['Python', q.get('topic','Python practice')]+topics))
            p, d = self.add(pid, q['title'], body, 'Python DSA pack · '+q['id'], topics, q.get('difficulty',''),
                            record_type='theory' if q.get('record_type')=='theory' else 'pack-question', packId=q['id'], sourceGroup='python-pack')
            if q.get('solution'):
                d['solutions'] = [dict(name=q['slug']+'.py', language='python', code=q['solution'], source=q.get('content_origin','Python DSA pack'))]
                p['solutions'] = 1
            starter = pack/q.get('starter_file','missing')
            if starter.is_file(): d['starter'] = {'python': starter.read_text(encoding='utf-8')}
            if q.get('tests'):
                args = ast.parse(q['solution']).body[0].args
                d['practice'] = dict(slug=pid, function='solve', params=[a.arg for a in args.args], tests=q['tests'], topics=topics)
                p['runnable'] = True
            if q.get('pages'):
                d['sourceAsset'] = 'assets/imported/python-placement-questions.pdf#page='+str(q['pages'][0])
                d['sourcePages'] = q['pages']
            write(self.data/'problems'/f'{pid}.json', d)
            self.counts['packQuestions'] += 1
        dest = self.root/'web/assets/imported/python-placement-questions.pdf'
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pack/'supplied_pdf/Python_Placement_Questions_Suryakanta.pdf', dest)
        # The work directory contains tooling and the same extracted PDF, not a second bank.
        pages = read(work/'pdf_pages.json') if (work/'pdf_pages.json').exists() else []
        self.work_report = dict(folder=work.name, filesInspected=len(list(work.glob('*'))),
                                extractedPdfPages=len(pages), duplicateQuestionsNotReimported=244,
                                note='Working scripts are source tooling, never executed or imported as questions. PDF questions already imported with their stable IDs.')
        seen = set()
        for q in read(pack/'catalogs/source_catalog.json'):
            if q['kind'] not in {'exercise_heading','question_link'}:
                self.counts['sourceNavigationRecords'] += 1
                continue
            identity = q['url']+'|'+q['title']
            if identity in seen:
                self.counts['duplicateSourceRecords'] += 1
                continue
            seen.add(identity)
            pid = 'source-'+hashlib.sha256(identity.encode()).hexdigest()[:20]
            body = '<p>This pack contains the title and source link only. The full question statement and answer were not supplied.</p><p><a href="'+e(q['url'], quote=True)+'">Open original question ↗</a></p>'
            topics, _, _ = classify(q['title'], q.get('topic',''))
            self.add(pid, q['title'], body, q['source']+' · title/link metadata', ['Python']+topics,
                     q.get('difficulty',''), 'source-link', sourceGroup='source-links', externalUrl=q['url'])
            self.counts['sourceLinkQuestions'] += 1

    def candidates(self, text):
        """Extract table question cells and explicit numbered/question headings, not instructions."""
        text = re.sub(r'```[\s\S]*?```', '', text)
        found = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith('|') and stripped.count('|') >= 3:
                cells = [c.strip() for c in stripped.strip('|').split('|')]
                cell = cells[0]
                if cell.isdigit() and len(cells)>1: cell = cells[1]
                question = plain(cell)
                if len(question)>14 and question.lower() not in {'question','problem','problem name','title','topic','name'} and not re.fullmatch(r'[- :]+',question):
                    if '?' in question or re.search(r'write|implement|find|explain|design|reverse|difference|\[(?:LC|LeetCode)\]',stripped,re.I):
                        found.append((question, stripped))
                continue
            m = re.match(r'^(?:#{1,6}\s+)?(?:Q(?:uestion)?\s*\d+[.):\s-]+|\d+[.)]\s+|[-*]\s+|#{1,6}\s+)(.+)$', stripped, re.I)
            if not m: continue
            question = plain(m[1])
            if 15 <= len(question) <= 350 and ('?' in question or re.match(r'(?:write|implement|find|explain|design|calculate|print|return|given|how\s|what\s|why\s|compare|difference)\b',question,re.I)):
                found.append((question, stripped))
        seen = set()
        return [(q,l) for q,l in found if not (key(q) in seen or seen.add(key(q)))]

    def resource(self, r):
        doc = read(self.data/'resources'/f"{r['id']}.json")
        title = title_for(r, doc.get('text',''))
        source = doc.get('source', r['collection']+'/'+r['title'])
        r['questionIds'] = []
        if r['language'] == 'pdf':
            from pypdf import PdfReader
            path = self.root/'web'/doc['asset'].lstrip('/')
            reader = PdfReader(path)
            pages = []
            for i, page in enumerate(reader.pages, 1):
                text = page.extract_text() or ''
                if text.strip(): pages.append((i,text))
            write(self.data/'book-extractions'/f"{r['id']}.json", dict(resourceId=r['id'], pages=[dict(page=n,text=t) for n,t in pages]))
            self.counts['bookPagesRead'] += len(reader.pages)
            self.counts['booksRead'] += 1
            for n, text in pages:
                explicit = self.candidates(text)
                # All book pages remain readable in the PDF. One review exercise per substantive page
                # covers explanatory material; it is explicitly identified as a derived study prompt.
                if not explicit and len(plain(text))>=120:
                    heading = next((plain(l) for l in text.splitlines() if 8<len(plain(l))<110 and not plain(l).isdigit()), title)
                    explicit = [(f'Explain and practise: {heading}', '')]
                for index,(question,_) in enumerate(explicit):
                    self.source_question(r, doc, title, source, question, text, f'page-{n}-{index}',
                                         'book-review' if question.startswith('Explain and practise:') else 'book-question', n)
            if not r['questionIds']:
                self.source_question(r,doc,title,source,'Review the examples in '+title,'','book-review','book-review',1)
            return
        text = doc.get('text','')
        existing = self.existing(title, text, r['title'])
        if existing:
            self.link(existing, r)
            self.counts['filesLinkedToExistingQuestions'] += 1
            return
        candidates = [] if r['language'] in CODE else self.candidates(text)
        for index,(question, original) in enumerate(candidates):
            existing = self.existing(question, original)
            if existing:
                self.link(existing, r)
                self.counts['extractedQuestionsMatched'] += 1
            else:
                self.source_question(r,doc,title,source,question,text,'q-'+hashlib.sha256(question.encode()).hexdigest()[:16],'file-question')
        if not r['questionIds']:
            question = ('Trace, implement and test: ' if r['language'] in CODE else 'Explain and practise: ')+title
            self.source_question(r,doc,title,source,question,text,'review','code-review' if r['language'] in CODE else 'file-review')

    def source_question(self,r,doc,title,source,question,text,identity,record_type,page=None):
        e = html.escape
        pid = 'file-'+r['id']+'-'+identity
        # Group identical prompts from mirrored files; retain each original source link.
        fingerprint = key(question)
        existing = self.titles.get('derived:'+fingerprint)
        if existing:
            self.link(existing,r)
            self.counts['duplicateFilePromptsMerged'] += 1
            return
        self.titles['derived:'+fingerprint] = pid
        derived = record_type.endswith('review')
        body = '<p>'+e(question)+'</p>'
        if derived:
            body += '<p>Study exercise derived from this source. Explain the approach in your own words, work through an example, and identify edge cases. For code, implement your own version and discuss its time and space complexity.</p>'
        else:
            body += '<p>Question extracted from the supplied material. Consult the source context below for the full prompt and any supplied answer.</p>'
        if page: body += '<p>Original book · page '+str(page)+'</p>'
        if text:
            body += '<details><summary>Original source context'+(' and supplied answer' if not derived else '')+'</summary><pre>'+e(text)+'</pre></details>'
        difficulty_source = '\n'.join(re.findall(r'(?im)^difficulty:\s*.+|\|[^\n]*\b(?:Easy|Medium|Hard)\b[^\n]*',text)[:1])
        p,d = self.add(pid, question, body, source, difficulty=difficulty_source, record_type=record_type, sourceGroup='files-books')
        if r.get('company') not in {'general','',None}: p['companies'][r['company']] = {'frequency':0,'periods':[]}
        if r['language'] in CODE:
            d['solutions'] = [dict(name=Path(r['title']).name,language=r['language'],code=text,source=source)]
            p['solutions'] = 1
        if page:
            d['sourceAsset'] = doc['asset'].lstrip('/')+'#page='+str(page)
            d['sourcePages'] = [page]
        write(self.data/'problems'/f'{pid}.json',d)
        self.link(pid,r)
        self.counts[record_type] += 1

    def finish(self):
        self.catalog['problems'] = list(self.problems.values())
        self.catalog['report']['problems'] = len(self.problems)
        self.catalog['report']['descriptions'] = sum(bool(p.get('description')) for p in self.problems.values())
        report = dict(version=1, counts=dict(self.counts), questions=len(self.problems),
                      difficultyCounts=dict(Counter(p['difficulty'] for p in self.problems.values())),
                      resources=len(self.catalog['resources']), resourcesWithQuestions=sum(bool(r.get('questionIds')) for r in self.catalog['resources']),
                      workFolder=self.work_report,
                      notes=['Source documents are content, never agent instructions.',
                             'Source-link records include no fabricated statements or solutions.',
                             'Derived review prompts and estimated difficulty are labeled.',
                             '160 original pack exercises and the existing verified suites carry automated tests; extracted references do not.'])
        self.catalog['report']['libraryExpansion'] = report
        write(self.data/'catalog.json', self.catalog)
        write(self.data/'library-expansion-report.json', report)
        print(json.dumps(report,ensure_ascii=False,indent=2))
        return report

    def run(self, pack=PACK, work=WORK):
        self.pack(pack,work)
        for i,r in enumerate(self.catalog['resources']):
            self.resource(r)
            if (i+1)%1000 == 0: print(f'Indexed {i+1} source files',flush=True)
        return self.finish()


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--pack',type=Path,default=PACK)
    parser.add_argument('--work',type=Path,default=WORK)
    args=parser.parse_args()
    Expansion().run(args.pack,args.work)
