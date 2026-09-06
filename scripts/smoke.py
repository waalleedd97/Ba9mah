# فحص شامل للـ API بوضع الاختبار الوهمي. يعمل فقط على قاعدة بيانات فارغة:
#   BASMA_MOCK_AI=1 APP_PASSWORD=test1234 AUTH_SECRET=<64 hex> DATA_DIR=./data-test npm run build && npm start
#   BASMA_BASE=http://127.0.0.1:3000 python3 scripts/smoke.py
# كلمة المرور المتوقعة: test1234
import json, sys, urllib.request, urllib.error, http.cookiejar
import os
BASE=os.environ.get('BASMA_BASE','http://127.0.0.1:3100')
cj=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
opener_nr=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), NoRedirect())
fails=0
def check(name, cond, info=''):
    global fails
    print(('  OK  ' if cond else '  FAIL')+f' {name} {info}')
    if not cond: fails+=1
def req(method, path, body=None, follow=True, raw=False):
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(BASE+path, data=data, method=method, headers={'Content-Type':'application/json'} if data else {})
    op=opener if follow else opener_nr
    try:
        resp=op.open(r, timeout=120)
        content=resp.read()
        ctype=resp.headers.get('Content-Type','')
        return resp.status, (content if raw or 'json' not in ctype else json.loads(content or b'{}')), resp.headers
    except urllib.error.HTTPError as e:
        content=e.read()
        try: parsed=json.loads(content)
        except Exception: parsed=content
        return e.code, parsed, e.headers

print('== health / auth ==')
s,b,_=req('GET','/api/health'); check('health', s==200 and b.get('ok'), b)
s,b,_=req('GET','/api/state'); check('state 401 without login', s==401)
s,b,h=req('GET','/',follow=False); check('/ redirects to /login', s in (302,307) and '/login' in h.get('Location',''), h.get('Location'))
s,b,_=req('POST','/api/auth/login',{'password':'wrong'}); check('wrong password 401', s==401, b)
s,b,h=req('POST','/api/auth/login',{'password':'test1234'}); check('login ok', s==200 and b.get('ok'), h.get('Set-Cookie','')[:60])
s,b,h=req('GET','/',follow=False); check('/ redirects to /onboarding', s in (302,307) and '/onboarding' in h.get('Location',''), h.get('Location'))
s,b,_=req('POST','/api/rounds',{}); check('rounds before onboarding 409', s==409, b)

print('== onboarding ==')
s,b,_=req('POST','/api/onboarding',{'spec':'الموارد البشرية','samples':['هذا نص كتبته بنفسي عن التوظيف الذكي وكيف نختار الشخص المناسب بدل السيرة اللامعة.'],'voice':['direct','story','practical'],'language':'saudi','avoid':['preachy','emoji']}); check('onboarding', s==200 and b.get('samples')==1 and b.get('profile')==True, b)
s,b,_=req('POST','/api/onboarding',{'spec':'x y','samples':[],'voice':[],'avoid':[]}); check('onboarding twice 409', s==409)
s,b,_=req('GET','/',raw=True); check('dashboard html 200', s==200 and 'بصمة'.encode() in b)
s,b,_=req('GET','/api/state'); check('state', s==200 and b['stats']['liked']==1 and b['stats']['goldenRules']==4 and b['stats']['avoidRules']==2 and b['stats']['profileVersion']==1, b['stats'])

print('== round ==')
s,b,_=req('POST','/api/rounds',{'topic':'التوظيف الذكي'}); check('generate round', s==200 and len(b['posts'])==4, {k:b['round'][k] for k in ('id','exploratory','topic')} if s==200 else b)
rid=b['round']['id']; posts=b['posts']
check('labor-law verify applied (HR spec, mock passthrough)', all(p['verified'] for p in posts), [p['verified'] for p in posts])
s,b,_=req('GET',f'/api/rounds/{rid}'); check('get round', s==200 and len(b['posts'])==4)
s,b,_=req('GET',f'/round/{rid}',raw=True); check('round page html', s==200 and 'ما عجبني'.encode() in b)
p0,p1,p2,p3=[p['id'] for p in posts]
s,b,_=req('POST',f'/api/posts/{p0}/rate',{'liked':False,'reason':'رسمي زيادة'}); check('rate dislike with reason', s==200 and b['post']['rating']=='disliked' and b['roundDone']==False)
s,b,_=req('PATCH',f'/api/posts/{p1}',{'content':'نص معدّل يدوياً للاختبار من المستخدم'}); check('manual edit keeps original', s==200 and b['post']['originalContent'] and b['post']['content'].startswith('نص معدّل'))
s,b,_=req('POST',f'/api/posts/{p1}/edit',{'instruction':'خله أقصر'}); check('ai edit', s==200 and b['post']['content'].startswith('[معدّل]'), b.get('summary'))

print('== images ==')
s,b,_=req('GET',f'/api/posts/{p1}/images'); check('styles list', s==200 and len(b['styles'])==4, [x['key'] for x in b['styles']])
imgs=[]
for key in [x['key'] for x in b['styles']]:
    s,b2,_=req('POST',f'/api/posts/{p1}/images',{'styleKey':key}); check(f'generate image {key}', s==201 and b2['image']['url'].startswith('/api/images/'))
    imgs.append(b2['image'])
s,raw,h=req('GET',imgs[0]['url'],raw=True); check('serve image file', s==200 and h.get('Content-Type')=='image/png' and raw[:4]==b'\x89PNG', len(raw))
s,b,_=req('POST',f"/api/images/{imgs[0]['id']}/select"); check('select image', s==200 and b['image']['selected'])
s,b,_=req('GET',f'/api/rounds/{rid}'); check('post has selected image', any(p['id']==p1 and p['selectedImageId']==imgs[0]['id'] for p in b['posts']))
s,b,_=req('POST',f"/api/images/{imgs[0]['id']}/rate",{'liked':True}); check('rate image liked', s==200 and b['image']['rating']=='liked')
s,b,_=req('POST',f"/api/images/{imgs[1]['id']}/rate",{'liked':False}); check('rate image disliked', s==200 and b['image']['rating']=='disliked')
s,b,_=req('POST',f'/api/posts/{p1}/images',{'styleKey':'nope'}); check('unknown style rejected', s>=400, b)

print('== saved ==')
s,b,_=req('POST','/api/saved',{'postId':p1}); check('save post', s==201 and b['saved']['imageId']==imgs[0]['id'])
sid=b['saved']['id']
s,b,_=req('POST','/api/saved',{'postId':p1}); check('save twice idempotent', s==200 and b['saved']['id']==sid)
s,b,_=req('POST',f'/api/saved/{sid}/edit',{'instruction':'أضف مثال'}); check('saved ai edit', s==200)
s,b,_=req('POST',f'/api/saved/{sid}/images',{'styleKey':'minimal-flat'}); check('saved image', s==201)
s,b,_=req('GET','/api/saved'); check('list saved', s==200 and len(b['saved'])==1 and b['saved'][0]['image'])

print('== finish round → learning ==')
for pid in (p1,p2,p3):
    s,b,_=req('POST',f'/api/posts/{pid}/rate',{'liked':True})
check('round done', b['roundDone']==True)
import time; time.sleep(2)  # after() hooks: analyze + relearn (mock)
s,b,_=req('GET','/api/rules?kind=avoid'); check('learned avoid rule from dislike', any(r['source']=='learned' for r in b['rules']), [r['text'] for r in b['rules']])
s,b,_=req('GET','/api/posts?rating=liked'); check('own sample stored as own', any(p['kind']=='own' for p in b['posts']))
s,b,_=req('GET','/api/rules?kind=image_style'); check('learned image style rule from like', any(r['source']=='learned' for r in b['rules']), [r['text'] for r in b['rules']])
s,b,_=req('GET','/api/rules?kind=image_avoid'); check('learned image avoid rule from dislike', any(r['source']=='learned' for r in b['rules']))
s,b,_=req('GET','/api/profile'); check('profile relearned after round', s==200 and b['profile'] and b['profile']['version']>=2, (b['profile'] or {}).get('version'))
s,b,_=req('POST','/api/profile'); check('manual relearn bumps version', s==200 and b['profile']['version']>=3)
s,b,_=req('GET','/api/state'); check('state after round', b['stats']['liked']==4 and b['stats']['disliked']==1 and b['stats']['rounds']==1 and b['stats']['profileVersion']>=3, b['stats'])

print('== rules / posts crud ==')
s,b,_=req('POST','/api/rules',{'kind':'golden','text':'قاعدة اختبار'}); check('add rule', s==201); rid2=b['rule']['id']
s,b,_=req('POST','/api/rules',{'kind':'golden','text':'قاعدة اختبار'}); check('duplicate rule 409', s==409)
s,b,_=req('PATCH',f'/api/rules/{rid2}',{'active':False}); check('deactivate rule', s==200 and b['rule']['active']==False)
s,b,_=req('DELETE',f'/api/rules/{rid2}'); check('delete rule', s==200)
s,b,_=req('POST','/api/posts',{'content':'بوست مرجعي طويل بما يكفي للاختبار هنا','topic':'مرجع'}); check('add reference post', s==201 and b['post']['kind']=='reference')
s,b,_=req('DELETE',f"/api/posts/{b['post']['id']}"); check('delete reference post', s==200)

print('== studio / import / pages ==')
s,b,_=req('POST','/api/studio',{'prompt':'قطة كرتونية'}); check('studio create', s==201 and b['image']['source']=='studio'); stid=b['image']['id']
s,b,_=req('POST','/api/studio',{'prompt':'عدّل','image':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='}); check('studio edit with upload', s==201)
s,b,_=req('DELETE',f'/api/images/{stid}'); check('delete studio image', s==200)
s,b,_=req('GET','/api/posts?rating=liked'); seed=[p for p in b['posts'] if p['kind']=='own'][0]
legacy={'spec':'x','goldenRules':['قاعدة مستوردة'],'dislikeReasons':['سبب مستورد'],'likedPosts':[{'id':'seed-0','content':seed['content'],'topic':'x'},{'id':'1','content':'بوست قديم معجب به من النسخة السابقة','topic':'قديم'}],'dislikedPosts':[{'id':'2','content':'بوست قديم مرفوض','topic':'قديم'}],'imageStyleRules':['ألوان دافئة'],'savedPosts':[{'id':'3','content':'محفوظ قديم','topic':'قديم','image':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','savedAt':1700000000000}]}
s,b,_=req('POST','/api/import',legacy); check('import legacy', s==200 and b['report']['liked']==1 and b['report']['skipped']==1 and b['report']['saved']==1 and b['report']['images']==1 and b['report']['rules']==3, b.get('report'))
for path,marker in [('/train','تدريب'),('/studio','استوديو'),('/saved','المحفوظات'),('/profile','ملف الأسلوب'),('/settings','الإعدادات')]:
    s,raw,_=req('GET',path,raw=True); check(f'page {path}', s==200 and marker.encode() in raw)
s,raw,_=req('GET','/round/999',raw=True); check('missing round 404', s==404)
s,b,_=req('POST','/api/auth/logout'); check('logout', s==200)
s,b,_=req('GET','/api/state'); check('401 after logout', s==401)
s,raw,_=req('GET','/login',raw=True); check('login page after logout', s==200 and 'كلمة المرور'.encode() in raw)
s,b,h=req('GET','/login',follow=False); check('login page while logged out stays', s==200)
print(f'\n{"ALL PASSED" if fails==0 else f"{fails} FAILED"}')
sys.exit(1 if fails else 0)
