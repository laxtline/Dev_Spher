"""Validate complete source coverage and run the original pack's supplied suites.

This check never writes personal progress or executes imported reference files.
"""
import json
from pathlib import Path
import server
from expand_library import write

ROOT=Path(__file__).resolve().parent


def verify():
    catalog=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
    by_id={p['id']:p for p in catalog['problems']}
    assert len(by_id)==len(catalog['problems']), 'Duplicate question ID'
    pack_ids={pid for p in by_id.values() for pid in [p['id']]+p.get('aliasIds',[]) if pid.startswith('pack-')};assert len(pack_ids)==404
    cases=0; suites=0
    for p in by_id.values():
        assert p['difficulty'] in {'Easy','Medium','Hard','Unknown'}
        if p.get('libraryExpansion'):
            d=json.loads((ROOT/'data/problems'/f"{p['id']}.json").read_text(encoding='utf-8'))
            assert d['html'].strip(),p['id']
            if d.get('sourceAsset'):
                assert (ROOT/'web'/d['sourceAsset'].split('#')[0]).is_file(),p['id']
            if d.get('practice') and any(pid.startswith('pack-pydsa-') for pid in [p['id']]+p.get('aliasIds',[])):
                result=server.execute(dict(id=p['id'],language='python',mode='submit',code=d['solutions'][0]['code']))
                assert result.get('accepted'),(p['id'],result)
                suites+=1;cases+=len(result['cases'])
        for rid in p.get('resourceIds',[]):
            assert (ROOT/'data/resources'/f'{rid}.json').is_file(),rid
    for r in catalog['resources']:
        assert r.get('questionIds'),r['id']
        assert all(pid in by_id for pid in r['questionIds']),r['id']
        assert all(r['id'] in by_id[pid].get('resourceIds',[]) for pid in r['questionIds']),r['id']
    assert suites==160,(suites,cases)
    assert cases==489,(suites,cases)
    result=dict(questions=len(by_id),packQuestions=404,resourcesCovered=len(catalog['resources']),
                packSuitesPassed=suites,packTestsPassed=cases,missingQuestionLinks=0,missingSourceFiles=0)
    write(ROOT/'data/library-validation.json',result)
    print(json.dumps(result,indent=2))
    return result


if __name__=='__main__': verify()
