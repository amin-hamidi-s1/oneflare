import json,urllib.request,urllib.error,re,sys,os
ENV=os.path.join(os.path.dirname(__file__),'.env.local')
env=open(ENV).read()
def g(k):
    m=re.search(rf'^export {k}=(.+)$',env,re.M); return m.group(1).strip().strip('"').strip("'") if m else None
URL=g('S1_CONSOLE_URL'); TOK=g('S1_CONSOLE_API_TOKEN')
ACCT=None; SITE=None
B=URL+"/web/api/v2.1/hyper-automate/api/public"
def api(path, method="GET", body=None, base=None):
    b=base or B
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(b+path, data=data, method=method,
        headers={"Authorization":f"ApiToken {TOK}","Content-Type":"application/json","Accept":"application/json"})
    try:
        r=urllib.request.urlopen(req,timeout=60)
        raw=r.read().decode()
        return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code, json.loads(raw)
        except: return e.code, {"raw":raw[:500]}
def mgmt(path, method="GET", body=None):
    return api(path, method, body, base=URL+"/web/api/v2.1")
if __name__=="__main__":
    print("console:", URL)
    st,d=api("/workflows?limit=100")
    print("list HTTP",st)
    for it in d.get('data',[]):
        w=it['workflow']
        print(f"{w['name']:34} | {it['id']} | state={w.get('state')}")

# ---- deploy helpers ----
SITE="2433185103040607397"; ACCT="1472380766023399132"
import uuid as _uuid
def multipart_import(defn_path, site=SITE):
    import io
    boundary="----wfb"+_uuid.uuid4().hex
    fbytes=open(defn_path,'rb').read()
    parts=[]
    def add(name,filename,ctype,content):
        h=f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
        if filename: h+=f'; filename="{filename}"'
        h+=f'\r\nContent-Type: {ctype}\r\n\r\n'
        parts.append(h.encode()+content+b'\r\n')
    add("file","workflow.json","application/json",fbytes)
    add("filter",None,"application/json",b'{}')
    parts.append(f'--{boundary}--\r\n'.encode())
    body=b''.join(parts)
    url=B+f"/workflow-import-export/import?siteIds={site}"
    req=urllib.request.Request(url,data=body,method="POST",headers={
        "Authorization":f"ApiToken {TOK}",
        "Content-Type":f"multipart/form-data; boundary={boundary}"})
    try:
        r=urllib.request.urlopen(req,timeout=90); raw=r.read().decode()
        return r.status,(json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code,json.loads(raw)
        except: return e.code,{"raw":raw[:800]}
def delete_wf(wid, acct=ACCT):
    return api(f"/../v1/workflows/{wid}?accountIds={acct}",method="DELETE") if False else \
        _raw("DELETE", URL+f"/web/api/v2.1/hyper-automate/api/v1/workflows/{wid}?accountIds={acct}")
def _raw(method,url,body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,data=data,method=method,headers={
        "Authorization":f"ApiToken {TOK}","Content-Type":"application/json"})
    try:
        r=urllib.request.urlopen(req,timeout=60); raw=r.read().decode()
        return r.status,(json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code,json.loads(raw)
        except: return e.code,{"raw":raw[:800]}
def publish_wf(wid, site=SITE):
    return _raw("POST", URL+f"/web/api/v2.1/hyper-automate/api/v1/workflows/{wid}/publish?siteIds={site}", body={})
def activate_wf(wid, vid, site=SITE):
    return _raw("POST", B+f"/workflows/{wid}/{vid}/activation?siteIds={site}", body={"data":{"timeout":86400}})

def import_wf(defn_path, site=SITE):
    d=json.load(open(defn_path))
    core={"name":d["name"],"description":d["description"],"actions":d["actions"]}
    url=B+f"/workflow-import-export/import?siteIds={site}"
    return _raw("POST",url,body={"data":core})
def delete_wf2(wid, site=SITE):
    return _raw("DELETE", URL+f"/web/api/v2.1/hyper-automate/api/v1/workflows/{wid}?siteIds={site}")
