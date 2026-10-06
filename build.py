#!/usr/bin/env python3
"""Join the shell, the engine, each scene and main into one artifact page: halcyon.html (or argv[1])."""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'halcyon.html')
# The site build (index.html) adds the document skeleton that the artifact host adds on its own
site = os.path.join(here, 'index.html')
rd = lambda p: open(os.path.join(src, p)).read()
# SCENES=rain builds the lake plus only the named scenes (so one scene in progress cannot break another's test build)
want = ['lake'] + [n for n in os.environ.get('SCENES', 'rain,fire').split(',') if n]
scenes = [f'scenes/{n}.js' for n in ('lake', 'rain', 'fire') if n in want and os.path.exists(os.path.join(src, 'scenes', f'{n}.js'))]
head = '''<script src="https://cdn.jsdelivr.net/npm/tone@15.0.4/build/Tone.js"></script>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.webgpu.min.js",
  "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.webgpu.min.js",
  "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.webgpu.min.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
'''
body = rd('engine.js') + ''.join('\n' + rd(s) for s in scenes) + '\n' + rd('main.js')
open(out, 'w').write(rd('shell-head.html') + head + '<script type="module">\n' + body + '\n</script>\n')
page = rd('shell-head.html') + head + '<script type="module">\n' + body + '\n</script>\n'
open(site, 'w').write('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + page)
print(out, len(scenes), 'scenes', os.path.getsize(out), 'bytes')
