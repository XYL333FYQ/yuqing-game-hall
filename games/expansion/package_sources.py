"""Provide the pinned upstream source and the exact adapted runtime together.

Run from any directory after importing/updating the runtimes. Requires Python
and Git only; it is deliberately separate from everyday frontend builds.
"""
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
GAMES = json.loads((HERE / 'SOURCES.json').read_text(encoding='utf-8'))
PATCHES = {
    'norman-necromancer': 'norman-engine.ts',
    'backcountry': 'backcountry-actions.ts',
    'thirteenth-floor': 'thirteenth-floor-index.ts',
}

for game in GAMES:
    checkout = ROOT / 'game-sources/upstream/expansion' / game['folder']
    upstream = subprocess.run(['git', 'archive', '--format=zip', game['commit']], cwd=checkout, check=True, capture_output=True).stdout
    runtime = ROOT / 'public/games' / game['id']
    output = runtime / 'source.zip'
    omitted = []
    with zipfile.ZipFile(io.BytesIO(upstream)) as original, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for entry in original.infolist():
            name = entry.filename
            if entry.is_dir():
                continue
            # Development recordings/compiler binaries are not game source.
            # Duplicate unchanged audio is supplied once in runtime/ instead.
            if name.startswith('devdiary/') or name.endswith('.jar') or Path(name).suffix.lower() in {'.ogg', '.mp3', '.wav', '.mp4', '.webm'}:
                omitted.append(name)
                continue
            archive.writestr('upstream/' + name, original.read(entry))
        for file in sorted(runtime.rglob('*')):
            if file.is_file() and file.name not in {'source.zip', 'cover.png'}:
                archive.write(file, 'runtime/games/' + game['id'] + '/' + file.relative_to(runtime).as_posix())
        for name in ['game-chinese.js', 'game-help.js', 'expansion-LICENSE']:
            archive.write(ROOT / 'public/games/_shared' / name, 'runtime/games/_shared/' + name)
        for file in sorted((ROOT / 'licenses').glob('*')):
            if file.is_file():
                archive.write(file, 'runtime/legal/licenses/' + file.name)
        archive.write(ROOT / 'THIRD_PARTY_NOTICES.md', 'runtime/legal/THIRD_PARTY_NOTICES.md')
        for name in ['SOURCES.json', 'ADAPTATIONS.json', 'build-adapted.mjs', 'package_sources.py']:
            archive.write(HERE / name, 'adaptations/' + name)
        if game['id'] in PATCHES:
            name = PATCHES[game['id']]
            archive.write(HERE / 'overrides' / name, 'adaptations/overrides/' + name)
        if game['id'] == 'super-castle':
            archive.write(HERE / 'vendor/natlib-0.1.13.tgz', 'dependencies/natlib-0.1.13.tgz')
        instructions = f'''# {game['title']} / {game['original']}

Upstream: https://github.com/{game['repo']}
Commit: {game['commit']}
License: {game['license']} (upstream license retained)

runtime/ contains the exact readable, adapted HTML/CSS/JavaScript and all game
assets. Serve it with `python -m http.server 8080 --directory runtime` and open
http://localhost:8080/games/{game['id']}/index.html . No platform or VPS is needed.

upstream/ contains the pinned preferred source, original build files and credit
notices. See its README and package.json for the original development workflow.
Generated/minified originals remain included, alongside the readable runtime.

For the four TypeScript adaptations, install this hall's pinned frontend tools
(Vite 8 / TypeScript), place the original source checkout at the recorded path,
then run `node games/expansion/build-adapted.mjs {game['id']} <source-path>`.
The supplied overrides replace the corresponding original src files; Casual
Crusade instead removes the first redundant super(0, 0, 0, 0) in src/pile.ts.
Use publicDir:false when building: copying a development public/index.html can
overwrite the production entry. Daily hall builds serve the committed runtimes.

For other games, runtime/ is the editable adapted source: preserve the shared
localization scripts, relative paths and SOURCE.md; ADAPTATIONS.json describes
the changes. Original build scripts are optional for these static runtimes.

The omitted entries below are development demonstrations, compiler executables
or duplicate unchanged audio. Runtime audio is supplied in runtime/; complete
program source and the assets needed to run the adapted game remain included.
{chr(10).join(omitted)}
'''
        archive.writestr('BUILD.md', instructions)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None, game['id']
    size = output.stat().st_size
    assert size <= 25 * 1024 * 1024, f'{game["id"]}: source archive exceeds Pages limit'
    print(f'{game["id"]}: {size / 1024 / 1024:.2f} MiB')
