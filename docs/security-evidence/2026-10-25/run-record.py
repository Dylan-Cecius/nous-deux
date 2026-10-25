import pathlib, json, hashlib, shutil, os, subprocess, time, socket, datetime
base = pathlib.Path('/workspace/scratch/01291f6896cc')
repo = base / 'nous-deux'
root = base / 'security-node22-20261025'
project = root / 'project'
nodebin = base / 'node22-check/node-v22.23.4-linux-x64/bin'
tree = json.loads((base/'current-tree.json').read_text())
root.mkdir(exist_ok=True)
sources = {}
for f in tree['tree']:
    p = f['path']
    if f['type'] != 'blob' or not (p.startswith(('functions/src/', 'functions/test/')) or p in ['functions/package.json','functions/package-lock.json','functions/tsconfig.json','firestore.rules','storage.rules','src/lib/memory-association.ts']):
        continue
    b = (repo/p).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest() == f['sha'], p
    dest = project/p
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(b)
    sources[p] = hashlib.sha256(b).hexdigest()
(root/'source-sha256.json').write_text(json.dumps(sources,indent=2)+'\n')
if not (project/'functions/node_modules').exists():
    (project/'functions/node_modules').symlink_to(repo/'functions/node_modules',target_is_directory=True)
config = {'firestore':{'rules':'firestore.rules'},'storage':{'rules':'storage.rules'},'emulators':{name:{'host':'127.0.0.1','port':port} for name,port in [('auth',9098),('firestore',8088),('storage',9198),('hub',4400),('logging',4500)]}}
config['emulators'].update({'ui':{'enabled':False},'singleProjectMode':True})
(project/'firebase.json').write_text(json.dumps(config,indent=2)+'\n')
shutil.copy2(repo/'docs/security-evidence/2026-10-24/loopback-only.c',root/'loopback-only.c')
subprocess.run(['gcc','-shared','-fPIC','-o',str(root/'loopback-only.so'),str(root/'loopback-only.c'),'-ldl'],check=True)
for name,expected in [('cloud-firestore-emulator-v1.19.8.jar','9d43599ed6151199e8d604dc87fac51218e49e5f3a48519b1ae560bbe5e3382d'),('cloud-storage-rules-runtime-v1.1.3.jar','0cd52db6f6271d62078f805220706377c849220b73bd68aa27078d977df9c900')]:
    assert hashlib.sha256((base/'security-isolated/emulators'/name).read_bytes()).hexdigest()==expected
env={'PATH':str(nodebin)+':/usr/local/bin:/usr/bin:/bin','HOME':str(root/'home'),'XDG_CONFIG_HOME':str(root/'home/.config'),'CI':'true','FIREBASE_CLI_DISABLE_UPDATE_CHECK':'true','FIREBASE_EMULATORS_PATH':str(base/'security-isolated/emulators'),'GCLOUD_PROJECT':'demo-nous-deux-security','GOOGLE_CLOUD_PROJECT':'demo-nous-deux-security','GOOGLE_APPLICATION_CREDENTIALS':str(root/'no-credentials.json'),'GCE_METADATA_HOST':'127.0.0.1:9','LD_PRELOAD':str(root/'loopback-only.so'),'JAVA_TOOL_OPTIONS':'-Djava.net.preferIPv4Stack=true','LANG':'C.UTF-8'}
(root/'home').mkdir(exist_ok=True)
assert not (root/'no-credentials.json').exists()
guard_js = r'''const net=require('node:net'),dns=require('node:dns').promises,assert=require('node:assert/strict');
async function denied(host) { await new Promise((resolve,reject)=>{ const s=net.connect({host,port:443});s.once('connect',()=>{s.destroy();reject(Error('unexpected connection'))});s.once('error',e=>{try{assert.equal(e.code,'EPERM');resolve()}catch(x){reject(x)}});}); }
(async()=>{const server=net.createServer(s=>s.end());await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise((r,j)=>{const s=net.connect(server.address().port,'127.0.0.1');s.once('connect',()=>{s.end();r()});s.once('error',j)});await new Promise(r=>server.close(r));await denied('192.0.2.1');await denied('2001:db8::1');await assert.rejects(dns.lookup('example.invalid'));console.log('Node loopback accepted; IPv4, IPv6 and external DNS blocked');})().catch(e=>{console.error(e);process.exitCode=1});'''
preflight=subprocess.run([str(nodebin/'node'),'-e',guard_js],env=env,capture_output=True,text=True,timeout=15)
(root/'guard-selfcheck.log').write_text(preflight.stdout+preflight.stderr)
assert preflight.returncode==0,preflight.stdout+preflight.stderr
for port in (9098,8088,9198,4400,4500):
    with socket.socket() as s: assert s.connect_ex(('127.0.0.1',port))!=0,port
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
start=time.monotonic()
with (root/'result.log').open('w') as log:
    subprocess.run(['node','--version'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    subprocess.run(['java','-version'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    build=subprocess.run(['npm','--prefix','functions','run','build'],cwd=project,env=env,stdout=log,stderr=subprocess.STDOUT)
    assert build.returncode==0,'compile failed'
    cmd=['functions/node_modules/.bin/firebase','emulators:exec','--config','firebase.json','--project','demo-nous-deux-security','--only','auth,firestore,storage','--non-interactive','npm --prefix functions test']
    result=subprocess.run(cmd,cwd=project,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=480)
ports={}
for port in (9098,8088,9198,4400,4500):
    with socket.socket() as s: ports[str(port)]=s.connect_ex(('127.0.0.1',port))!=0
record={'sourceCommit':'c735fff1c66ca95f1d3a280372a92a056c272f35','startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':result.returncode,'seconds':round(time.monotonic()-start,2),'node':'22.23.4','project':'demo-nous-deux-security','portsClosedAfter':ports,'isolation':'dedicated credential-free copy, demo project, SDK guard and process LD_PRELOAD; not kernel network isolation'}
(root/'result.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
print('\n'.join((root/'result.log').read_text().splitlines()[-55:]))
raise SystemExit(result.returncode)
