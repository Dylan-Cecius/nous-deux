import os,pathlib,subprocess,time,json
root=pathlib.Path('/workspace/scratch/01291f6896cc/security-isolated')
env={'PATH':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin','HOME':str(root/'home'),'XDG_CONFIG_HOME':str(root/'home/.config'),'CI':'true','FIREBASE_CLI_DISABLE_UPDATE_CHECK':'true','FIREBASE_EMULATORS_PATH':str(root/'emulators'),'GCLOUD_PROJECT':'demo-nous-deux-security','GOOGLE_CLOUD_PROJECT':'demo-nous-deux-security','GOOGLE_APPLICATION_CREDENTIALS':str(root/'no-credentials.json'),'GCE_METADATA_HOST':'127.0.0.1:9','LD_PRELOAD':str(root/'loopback-only.so'),'JAVA_TOOL_OPTIONS':'-Djava.net.preferIPv4Stack=true','LANG':'C.UTF-8'}
project=root/'project'
start=time.time()
with (root/'result.log').open('w') as log:
 build=subprocess.run(['npm','--prefix','functions','run','build'],cwd=project,env=env,stdout=log,stderr=subprocess.STDOUT)
 if build.returncode:raise SystemExit(build.returncode)
 command=['functions/node_modules/.bin/firebase','emulators:exec','--config','firebase.json','--project','demo-nous-deux-security','--only','auth,firestore,storage','--non-interactive','npm --prefix functions test']
 result=subprocess.run(command,cwd=project,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=480)
(root/'result.json').write_text(json.dumps({'exit':result.returncode,'seconds':round(time.time()-start,2),'project':'demo-nous-deux-security'},indent=2))
print((root/'result.json').read_text())
print('\n'.join((root/'result.log').read_text().splitlines()[-60:]))
raise SystemExit(result.returncode)
